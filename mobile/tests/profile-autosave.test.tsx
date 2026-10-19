import '../src/i18n';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProfileEditor } from '../src/profile/ProfileEditor';
import type { Choices, OwnProfile, ProfileApi } from '../src/profile/api';

const mockChoices: Choices = {
  genders: ['woman', 'man', 'nonbinary'],
  relationshipGoals: ['long_term', 'short_term', 'open_to_either', 'figuring_out'],
  interests: ['music', 'books', 'travel', 'cooking', 'sport'],
  languages: ['ქართული', 'English'],
};

const initialProfile: OwnProfile = {
  revision: 1,
  displayName: 'Dato',
  bio: 'Initial test bio',
  gender: 'man',
  desiredGenders: ['woman'],
  city: 'tbilisi',
  interests: ['music'],
  languages: ['ქართული', 'English'],
  relationshipGoal: 'long_term',
  visible: true,
  age: 25,
  complete: true,
  appLanguage: 'ka',
  photos: [],
};

describe('Profile Auto-Save Functionality', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('does NOT render a manual Save Profile button', () => {
    const mockSave = jest.fn();
    const mockApi = {
      save: mockSave,
    } as unknown as ProfileApi;

    render(
      <ProfileEditor
        profile={initialProfile}
        choices={mockChoices}
        api={mockApi}
        saved={jest.fn()}
      />
    );

    expect(screen.queryByText('პროფილის შენახვა')).toBeNull();
    expect(screen.queryByText('Save profile')).toBeNull();
  });

  test('auto-saves automatically when a choice chip (e.g. gender) is toggled', async () => {
    const updatedProfile = { ...initialProfile, gender: 'woman', revision: 2 };
    const mockSave = jest.fn().mockResolvedValue(updatedProfile);
    const mockSavedCallback = jest.fn();
    const mockApi = {
      save: mockSave,
    } as unknown as ProfileApi;

    render(
      <ProfileEditor
        profile={initialProfile}
        choices={mockChoices}
        api={mockApi}
        saved={mockSavedCallback}
      />
    );

    // Tap on Woman chip in gender section (first Woman occurrence)
    const womanChips = screen.getAllByText('Woman');
    fireEvent.press(womanChips[0]!);

    // Advance debounce timers
    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 1,
        gender: 'woman',
        displayName: 'Dato',
      })
    );

    expect(mockSavedCallback).toHaveBeenCalledWith(updatedProfile);
  });

  test('auto-saves debounced text changes when typing in bio or blurring', async () => {
    const updatedProfile = { ...initialProfile, bio: 'Brand new bio text', revision: 2 };
    const mockSave = jest.fn().mockResolvedValue(updatedProfile);
    const mockSavedCallback = jest.fn();
    const mockApi = {
      save: mockSave,
    } as unknown as ProfileApi;

    render(
      <ProfileEditor
        profile={initialProfile}
        choices={mockChoices}
        api={mockApi}
        saved={mockSavedCallback}
      />
    );

    const bioInput = screen.getByLabelText(/About you/i);
    fireEvent.changeText(bioInput, 'Brand new bio text');

    // Before debounce timer expires, save should not have fired yet
    expect(mockSave).not.toHaveBeenCalled();

    // Fast-forward past the 700ms text debounce
    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 1,
        bio: 'Brand new bio text',
      })
    );
  });
});
