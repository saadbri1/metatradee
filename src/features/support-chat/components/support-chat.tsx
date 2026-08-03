'use client';

/**
 * The MetaTradee Assistant — the one component a page mounts.
 *
 * IT OWNS OPEN/CLOSED AND NOTHING ELSE. Conversation state lives in
 * `useSupportChat` and is held HERE rather than inside the panel, so closing
 * the widget does not throw away what someone has already typed and explained.
 *
 * THE PANEL IS NOT RENDERED UNTIL IT IS OPENED. Every public page carries this
 * component, so the closed state must cost as close to nothing as possible: one
 * button, and no transcript, no form and no escalation action reference until
 * someone actually asks for help.
 *
 * FOCUS RETURNS TO THE LAUNCHER on close, including via Escape — otherwise a
 * keyboard user who dismisses the panel is dropped back at the top of the
 * document.
 */
import { useCallback, useRef, useState } from 'react';
import { ChatbotLauncher } from './chatbot-launcher';
import { ChatbotPanel } from './chatbot-panel';
import { useSupportChat } from '../use-support-chat';

const PANEL_ID = 'metatradee-support-chat';
const TITLE_ID = 'metatradee-support-chat-title';

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const chat = useSupportChat();
  const launcherRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  return (
    <>
      <ChatbotLauncher
        locale={chat.locale}
        open={open}
        onToggle={() => (open ? close() : setOpen(true))}
        controls={PANEL_ID}
        buttonRef={launcherRef}
      />
      {/* The container is always present so `aria-controls` on the launcher
          resolves to a real element even while the panel is closed. */}
      <div id={PANEL_ID}>
        {open ? <ChatbotPanel chat={chat} onClose={close} labelledBy={TITLE_ID} /> : null}
      </div>
    </>
  );
}
