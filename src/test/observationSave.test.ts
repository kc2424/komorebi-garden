import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGardenStore } from '../hooks/useGardenStore';
import { resetLocalDbForTests } from '../storage/localDb';
import * as persistence from '../storage/persistence';

describe('useGardenStore observation save', () => {
  beforeEach(() => {
    resetLocalDbForTests();
    localStorage.clear();
  });

  it('does not update state when IndexedDB save fails', async () => {
    const { result } = renderHook(() => useGardenStore());

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    const saveState = vi.spyOn(persistence, 'saveState').mockResolvedValue({
      ok: false,
      error: '保存容量が不足しています。',
    });

    let saveResult: Awaited<ReturnType<typeof result.current.saveObservation>> | undefined;
    await act(async () => {
      saveResult = await result.current.saveObservation({
        plantType: 'tulip',
        commonNameJa: 'チューリップ',
        scientificName: 'Tulipa gesneriana',
        familyName: 'ユリ科',
        color: 'red',
        imageDataUrl: 'data:image/jpeg;base64,abc',
        trait: '',
        isSample: true,
        identificationSource: 'sample',
      });
    });

    expect(saveResult?.saved).toBe(false);
    expect(result.current.state.observations).toHaveLength(0);
    expect(result.current.saveError).toContain('保存');

    saveState.mockRestore();
  });
});
