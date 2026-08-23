import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LogDetailsButton } from './LogDetailsButton';

test('opens log details from the native log row menu', async () => {
  const onClick = jest.fn();
  const user = userEvent.setup();

  render(<LogDetailsButton onClick={onClick} />);

  const button = screen.getByRole('button', { name: 'Open log details' });
  await user.click(button);

  expect(onClick).toHaveBeenCalledTimes(1);
});
