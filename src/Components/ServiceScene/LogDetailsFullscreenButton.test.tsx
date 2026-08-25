import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LogDetailsFullscreenButton } from './LogDetailsFullscreenButton';
import { testIds } from 'services/testIds';

describe('LogDetailsFullscreenButton', () => {
  it('enters fullscreen from the default state', async () => {
    const onToggle = jest.fn();
    const user = userEvent.setup();

    render(<LogDetailsFullscreenButton isFullscreen={false} onToggle={onToggle} />);

    const button = screen.getByTestId(testIds.logDetails.fullscreenToggle);
    expect(button).toHaveAccessibleName('Enter fullscreen');
    await user.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('exposes the exit action while fullscreen', () => {
    render(<LogDetailsFullscreenButton isFullscreen onToggle={jest.fn()} />);

    expect(screen.getByTestId(testIds.logDetails.fullscreenToggle)).toHaveAccessibleName('Exit fullscreen');
  });
});
