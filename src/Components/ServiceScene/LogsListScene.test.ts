import { initializeNativeLogContextWrap } from './LogsListScene';

function createLogContextDialog(checked: boolean): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.innerHTML = `
    <button data-testid="revert-button" type="button"></button>
    <input role="switch" type="checkbox" ${checked ? 'checked' : ''} />
  `;
  document.body.append(dialog);
  return dialog;
}

describe('initializeNativeLogContextWrap', () => {
  afterEach(() => document.body.replaceChildren());

  it('turns wrapping off once and preserves later user changes in the same dialog', () => {
    const dialog = createLogContextDialog(true);
    const wrapToggle = dialog.querySelector<HTMLInputElement>('input[role="switch"]');

    const initializedDialog = initializeNativeLogContextWrap(document);

    expect(initializedDialog).toBe(dialog);
    expect(wrapToggle).not.toBeChecked();

    wrapToggle?.click();
    initializeNativeLogContextWrap(document, initializedDialog);

    expect(wrapToggle).toBeChecked();
  });

  it('initializes a newly opened dialog and ignores unrelated switches', () => {
    const unrelatedDialog = document.createElement('div');
    unrelatedDialog.setAttribute('role', 'dialog');
    unrelatedDialog.innerHTML = '<input role="switch" type="checkbox" checked />';
    document.body.append(unrelatedDialog);

    expect(initializeNativeLogContextWrap(document)).toBeUndefined();
    expect(unrelatedDialog.querySelector('input')).toBeChecked();

    const firstDialog = createLogContextDialog(false);
    const initializedDialog = initializeNativeLogContextWrap(document);
    firstDialog.remove();
    const nextDialog = createLogContextDialog(true);

    const nextInitializedDialog = initializeNativeLogContextWrap(document, initializedDialog);

    expect(nextInitializedDialog).toBe(nextDialog);
    expect(nextDialog.querySelector('input')).not.toBeChecked();
  });
});
