import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

interface DropdownOption {
  label: string;
  onClick: () => void;
  className?: string;
  icon?: ReactNode;
}

interface DropdownProps {
  options: DropdownOption[];
  trigger?: ReactNode;
  align?: 'left' | 'right';
}

export default function Dropdown({ options, trigger, align = 'right' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const defaultTrigger = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
      }}
      className="p-2 hover:bg-gray-100 rounded-lg transition"
    >
      <svg className="h-5 w-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
      </svg>
    </button>
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {trigger ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          {trigger}
        </div>
      ) : (
        defaultTrigger
      )}

      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } top-full mt-1 w-48 bg-white rounded-lg shadow-2xl border border-gray-200 py-1 z-[100]`}
          style={{ minWidth: '12rem' }}
        >
          {options.map((option, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                option.onClick();
                setIsOpen(false);
              }}
              className={
                option.className ||
                'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2'
              }
            >
              {option.icon && <span>{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
