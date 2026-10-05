import XCTest

final class GardenSmokeTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.komorebi.garden")

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func record(_ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = "\(name)-accessibility"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
        print("GARDEN_STEP: \(name)")
        print(app.debugDescription)
    }

    func testCreatePlantAndPersistOnRelaunch() throws {
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20), "Native WKWebView did not appear")
        record("01-launched")
        let start = app.buttons["庭づくりをはじめる"]
        if start.waitForExistence(timeout: 5) {
            start.tap()
        } else if app.buttons["庭づくり"].waitForExistence(timeout: 3) {
            app.buttons["庭づくり"].tap()
        }
        XCTAssertTrue(app.buttons["眺める"].waitForExistence(timeout: 10), "Could not enter garden building")
        record("02-building-catalog")
        let flower = app.switches["デイジー"]
        XCTAssertTrue(flower.waitForExistence(timeout: 10), "Expanded plant catalog did not contain daisy")
        flower.tap()
        record("03-daisy-selected")
        let confirm = app.buttons["ここに植える"]
        for point in [CGVector(dx: 0.50, dy: 0.30), CGVector(dx: 0.45, dy: 0.36), CGVector(dx: 0.56, dy: 0.39), CGVector(dx: 0.42, dy: 0.30)] {
            app.coordinate(withNormalizedOffset: point).tap()
            if confirm.waitForExistence(timeout: 3) && confirm.isEnabled { break }
        }
        record("04-placement-preview")
        XCTAssertTrue(confirm.exists && confirm.isEnabled, "Garden canvas tap did not produce a valid placement")
        confirm.tap()
        let saved = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "保存済み")).firstMatch
        XCTAssertTrue(saved.waitForExistence(timeout: 10), "Placement did not become saved")
        record("05-plant-saved")
        app.buttons["眺める"].tap()
        XCTAssertTrue(app.buttons["庭全体を見る"].waitForExistence(timeout: 5))
        app.buttons["庭全体を見る"].tap()
        let savedPlant = app.buttons["デイジーの思い出を見る"]
        XCTAssertTrue(savedPlant.waitForExistence(timeout: 5), "Saved daisy absent from garden navigation")
        record("06-overview")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
        XCTAssertTrue(savedPlant.waitForExistence(timeout: 15), "Saved daisy missing after native app relaunch")
        XCTAssertFalse(app.buttons["庭づくりをはじめる"].exists, "Onboarding reappeared after saving")
        record("07-relaunch-persisted")
    }

    func testInspectFinalSavedPlant() throws {
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
        let savedPlant = app.buttons["デイジーの思い出を見る"]
        XCTAssertTrue(savedPlant.waitForExistence(timeout: 15), "Saved daisy lost during app update")
        XCTAssertEqual(app.buttons.matching(identifier: "デイジーの思い出を見る").count, 1, "Unexpected plant count after update")
        XCTAssertFalse(app.buttons["庭づくりをはじめる"].exists)
        record("final-01-saved-garden")
        let points = app.frame.width > 600
            ? [CGVector(dx: 0.43, dy: 0.37), CGVector(dx: 0.43, dy: 0.39), CGVector(dx: 0.42, dy: 0.38)]
            : [CGVector(dx: 0.50, dy: 0.363), CGVector(dx: 0.50, dy: 0.375), CGVector(dx: 0.49, dy: 0.377)]
        for point in points {
            app.coordinate(withNormalizedOffset: point).tap()
            if app.staticTexts["Bellis perennis"].waitForExistence(timeout: 3) { break }
        }
        XCTAssertTrue(app.staticTexts["Bellis perennis"].waitForExistence(timeout: 10), "New plant intro scientific name missing")
        XCTAssertTrue(app.staticTexts["白い花びらが輪になった小さな花"].exists, "New plant introduction missing")
        XCTAssertTrue(app.buttons["閉じる"].exists)
        Thread.sleep(forTimeInterval: 5)
        record("final-02-plant-introduction")
        let gardenFrame = app.otherElements["3D庭"].firstMatch.frame
        XCTAssertTrue(gardenFrame.contains(app.buttons["閉じる"].frame), "Close button clipped outside garden frame")
        XCTAssertTrue(gardenFrame.contains(app.staticTexts["白い花びらが輪になった小さな花"].frame), "Plant introduction clipped outside garden frame")
        app.buttons["閉じる"].tap()
        app.buttons["庭全体を見る"].tap()
        Thread.sleep(forTimeInterval: 3)
        record("final-03-overview")
    }


    func testInspectFocusTransition() throws {
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["デイジーの思い出を見る"].waitForExistence(timeout: 15))
        XCTAssertEqual(app.buttons.matching(identifier: "デイジーの思い出を見る").count, 1)
        Thread.sleep(forTimeInterval: 2)
        record("transition-00-overview")
        let point = app.frame.width > 600
            ? CGVector(dx: 0.43, dy: 0.37)
            : CGVector(dx: 0.50, dy: 0.363)
        let start = Date()
        print("FOCUS_TAP_START: \(start.timeIntervalSince1970)")
        app.coordinate(withNormalizedOffset: point).tap()
        for index in 0..<9 {
            let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            shot.name = String(format: "transition-%02d-%.3f-seconds", index + 1, Date().timeIntervalSince(start))
            shot.lifetime = .keepAlways
            add(shot)
            Thread.sleep(forTimeInterval: 0.25)
        }
        XCTAssertTrue(app.staticTexts["Bellis perennis"].waitForExistence(timeout: 8))
        Thread.sleep(forTimeInterval: 3)
        record("transition-10-stable-introduction")
        let gardenFrame = app.otherElements["3D庭"].firstMatch.frame
        XCTAssertTrue(gardenFrame.contains(app.buttons["閉じる"].frame), "Close button clipped outside garden frame")
        XCTAssertTrue(gardenFrame.contains(app.staticTexts["白い花びらが輪になった小さな花"].frame), "Plant introduction clipped outside garden frame")
        app.buttons["閉じる"].tap()
        app.buttons["庭全体を見る"].tap()
        Thread.sleep(forTimeInterval: 3)
        record("transition-11-final-overview")
    }

    func testVisitAndReturnPreservesOwnGarden() throws {
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
        let saved = app.buttons["デイジーの思い出を見る"]
        XCTAssertTrue(saved.waitForExistence(timeout: 15))
        XCTAssertEqual(app.buttons.matching(identifier: "デイジーの思い出を見る").count, 1)
        let outings = app.buttons["おでかけ"]
        XCTAssertTrue(outings.waitForExistence(timeout: 5))
        outings.tap()
        record("visit-01-gallery")
        let visit = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "遊びに行く")).firstMatch
        XCTAssertTrue(visit.waitForExistence(timeout: 10))
        visit.tap()
        XCTAssertTrue(app.buttons["庭全体を見る"].waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["ここに植える"].exists)
        XCTAssertFalse(app.buttons["庭づくり"].exists)
        Thread.sleep(forTimeInterval: 3)
        record("visit-02-sample-overview")
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.40, dy: 0.48)).press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.66, dy: 0.48)))
        app.buttons["庭全体を見る"].tap()
        Thread.sleep(forTimeInterval: 2)
        let home = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "自分の庭")).firstMatch
        XCTAssertTrue(home.waitForExistence(timeout: 5))
        XCTAssertTrue(app.frame.contains(home.frame))
        home.tap()
        XCTAssertTrue(saved.waitForExistence(timeout: 10))
        XCTAssertEqual(app.buttons.matching(identifier: "デイジーの思い出を見る").count, 1)
        record("visit-03-own-garden-restored")
        app.terminate()
        app.launch()
        XCTAssertTrue(saved.waitForExistence(timeout: 15))
        XCTAssertEqual(app.buttons.matching(identifier: "デイジーの思い出を見る").count, 1)
        record("visit-04-own-garden-relaunched")
    }

}
