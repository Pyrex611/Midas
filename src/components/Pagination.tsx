import React from 'react';
import { Icons } from '../lib/icons';

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<Props> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-gold-500/35 bg-white px-4 py-3 sm:px-6 mt-2">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-xl border border-gold-500/40 bg-white px-4 py-2 text-xs font-bold text-royal-800 hover:bg-thistle-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-xl border border-gold-500/40 bg-white px-4 py-2 text-xs font-bold text-royal-800 hover:bg-thistle-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-thistle-500">
            Page <span className="font-bold text-royal-950">{currentPage}</span> of{' '}
            <span className="font-bold text-royal-950">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-xl shadow-xs overflow-hidden border border-gold-500/40" aria-label="Pagination">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-3 py-2 bg-white text-royal-800 hover:bg-thistle-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="sr-only">Previous</span>
              <Icons.ChevronLeft />
            </button>
            <span className="relative inline-flex items-center px-4 py-2 text-xs font-black text-white bg-royal-700 border-x border-gold-500/40">
              {currentPage}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-3 py-2 bg-white text-royal-800 hover:bg-thistle-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="sr-only">Next</span>
              <Icons.ChevronLeft className="rotate-180" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};