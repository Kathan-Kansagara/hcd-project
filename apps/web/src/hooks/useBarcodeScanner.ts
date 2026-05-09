import { useEffect, useRef, useCallback } from 'react';

interface BarcodeScannerOptions {
  /** Minimum length of barcode to accept (default: 4) */
  minLength?: number;
  /** Maximum time between keystrokes in ms (default: 50ms — scanners type very fast) */
  maxInterCharDelay?: number;
  /** Whether the scanner is enabled (default: true) */
  enabled?: boolean;
  /** Optional prefix filter — only accept barcodes starting with this */
  prefix?: string;
}

/**
 * Custom hook to detect barcode scanner input.
 * Barcode scanners emulate keyboard input — they type characters rapidly and end with Enter.
 * This hook distinguishes scanner input from normal typing by:
 * 1. Measuring the time between keystrokes (scanners are <50ms apart)
 * 2. Requiring a minimum barcode length
 * 3. Looking for Enter key as the terminator
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  options: BarcodeScannerOptions = {}
) {
  const {
    minLength = 4,
    maxInterCharDelay = 80,
    enabled = true,
    prefix,
  } = options;

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  // Keep callback ref up to date
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // If in the scan-pay dialog's manual input, skip (we handle that separately)
      if (isInputField && target.getAttribute('data-barcode-input') !== 'true') {
        return;
      }

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;

      // If too much time has passed, reset the buffer
      if (timeSinceLastKey > maxInterCharDelay) {
        bufferRef.current = '';
      }

      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();

        if (barcode.length >= minLength) {
          // Check prefix filter
          if (!prefix || barcode.startsWith(prefix)) {
            e.preventDefault();
            e.stopPropagation();
            onScanRef.current(barcode);
          }
        }

        bufferRef.current = '';
        return;
      }

      // Only accumulate printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, minLength, maxInterCharDelay, prefix]);

  return { resetBuffer };
}
