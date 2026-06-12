/**
 * Snap-a-Menu native screen tests.
 *
 * Pins: camera/library both feed the preview, submit posts the picked
 * uri to the API, the result card shows dish + why + alternatives +
 * warnings, and a denied camera permission alerts instead of crashing.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../../../services/api', () => ({
  api: { snapMenu: jest.fn() },
}));
jest.mock('../../../services/analytics', () => ({
  track: jest.fn(),
}));

const ImagePicker = require('expo-image-picker');
const { api } = require('../../../services/api');
const MenuSnapScreen = require('../menu-snap').default;

const REC = {
  dish: 'Tagliata di manzo',
  why: "The menu's best value for a savoury palate.",
  alternatives: ['Risotto ai funghi'],
  warnings: ['Spice level not marked'],
  share_title: "Tonight: Tagliata di manzo.",
};

beforeEach(() => {
  ImagePicker.requestCameraPermissionsAsync.mockReset();
  ImagePicker.launchCameraAsync.mockReset();
  ImagePicker.launchImageLibraryAsync.mockReset();
  api.snapMenu.mockReset();
});

describe('Snap-a-Menu screen', () => {
  test('renders the tagline and both pick buttons', async () => {
    const { findByText, getByTestId } = render(<MenuSnapScreen />);
    expect(await findByText(/Order like a local/)).toBeDefined();
    expect(getByTestId('snap-camera')).toBeDefined();
    expect(getByTestId('snap-library')).toBeDefined();
  });

  test('camera flow: permission granted → photo picked → submit posts the uri', async () => {
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/menu.jpg' }],
    });
    api.snapMenu.mockResolvedValue({ source: 'ai', recommendation: REC });

    const { getByTestId, findByText } = render(<MenuSnapScreen />);
    fireEvent.press(getByTestId('snap-camera'));

    // Preview appeared; submit button now visible.
    fireEvent.press(await findByText(/Tell me what to order/));

    await waitFor(() => expect(api.snapMenu).toHaveBeenCalled());
    expect(api.snapMenu.mock.calls[0][0]).toBe('file:///tmp/menu.jpg');

    expect(await findByText('Tagliata di manzo')).toBeDefined();
    expect(await findByText(/best value/)).toBeDefined();
    expect(await findByText(/Risotto ai funghi/)).toBeDefined();
    expect(await findByText(/Spice level not marked/)).toBeDefined();
  });

  test('library flow feeds the same pipeline', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/lib.jpg' }],
    });
    api.snapMenu.mockResolvedValue({ source: 'stub', recommendation: REC });

    const { getByTestId, findByText } = render(<MenuSnapScreen />);
    fireEvent.press(getByTestId('snap-library'));
    fireEvent.press(await findByText(/Tell me what to order/));

    await waitFor(() => expect(api.snapMenu).toHaveBeenCalled());
    expect(api.snapMenu.mock.calls[0][0]).toBe('file:///tmp/lib.jpg');
  });

  test('denied camera permission alerts instead of opening the camera', async () => {
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(<MenuSnapScreen />);
    fireEvent.press(getByTestId('snap-camera'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  test('cancelled picker leaves the screen unchanged', async () => {
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: true });

    const { getByTestId, queryByText } = render(<MenuSnapScreen />);
    fireEvent.press(getByTestId('snap-camera'));

    await waitFor(() => expect(ImagePicker.launchCameraAsync).toHaveBeenCalled());
    expect(queryByText(/Tell me what to order/)).toBeNull();
  });
});
