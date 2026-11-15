"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

/** Native <dialog>: focus trap, Escape to close and inert background come for free. */
export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[540px] rounded-xl border-0 bg-background-100 p-0 text-gray-1000 shadow-modal backdrop:bg-black/50"
    >
      {open && (
        <>
          <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-heading-24">{title}</h2>
              {description && <div className="mt-2 text-copy-14 text-gray-900">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mt-1 -mr-1 rounded-md p-1.5 text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000 focus-ring"
            >
              <X className="size-4" />
            </button>
          </div>
          {children && <div className="mt-6">{children}</div>}
          </div>
          {footer && (
            <div className="flex justify-between gap-2 rounded-b-xl border-t border-gray-alpha-400 bg-background-200 px-6 py-4">{footer}</div>
          )}
        </>
      )}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  danger,
  loading,
  confirmDisabled,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
