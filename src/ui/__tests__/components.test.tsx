import { fireEvent, render, screen } from '@testing-library/react-native';

import { Avatar } from '../Avatar';
import { BubbleButton } from '../BubbleButton';
import { XPBar } from '../XPBar';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

describe('BubbleButton', () => {
  it('renders its label and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<BubbleButton label="CHECK IN CLEAN" variant="clean" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'CHECK IN CLEAN' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', async () => {
    const onPress = jest.fn();
    await render(<BubbleButton label="Opens at 5pm" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Opens at 5pm' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Opens at 5pm' })).toBeDisabled();
  });

  it('shows a busy state while loading', async () => {
    await render(<BubbleButton label="Locking in…" loading />);
    expect(screen.getByRole('button', { name: 'Locking in…' })).toBeBusy();
  });
});

describe('XPBar', () => {
  it('shows progress toward the next rank', async () => {
    await render(<XPBar current={3} next={7} />);
    expect(screen.getByText('3/7')).toBeOnTheScreen();
  });

  it('shows MAX at Final Boss', async () => {
    await render(<XPBar current={15} next={null} />);
    expect(screen.getByText('MAX')).toBeOnTheScreen();
  });
});

function countHostType(node: unknown, type: string): number {
  if (!node || typeof node !== 'object') return 0;
  if (Array.isArray(node)) return node.reduce((n: number, child) => n + countHostType(child, type), 0);
  const el = node as { type?: string; children?: unknown };
  return (el.type === type ? 1 : 0) + countHostType(el.children ?? null, type);
}

describe('Avatar', () => {
  it('stacks one image per layer', async () => {
    await render(<Avatar inputs={{ avatarId: 'ace', rank: 'grinder', owesBox: true }} accessibilityLabel="Ace avatar" />);
    expect(screen.getByLabelText('Ace avatar')).toBeOnTheScreen();
    expect(countHostType(screen.toJSON(), 'Image')).toBe(3);
  });
});
