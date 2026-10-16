import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, LogIn, ShieldAlert } from 'lucide-react';
import AuthModal from './AuthModal';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  showSignInButton?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showAuthModal: boolean;
}

export default class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showAuthModal: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[AuthErrorBoundary] Caught authentication/component error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'An authentication or permission error occurred.';
      const isPermissionDenied = errorMsg.includes('permission-denied') || errorMsg.includes('Missing or insufficient permissions');
      const isAuthError = errorMsg.includes('auth/') || errorMsg.includes('unauthorized') || isPermissionDenied;

      return (
        <div className="w-full py-12 px-4 flex items-center justify-center">
          <div className="bg-[#141418] border border-white/10 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              {isAuthError ? <ShieldAlert size={24} /> : <AlertCircle size={24} />}
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">
                {this.props.fallbackTitle || (isAuthError ? 'Authentication Required' : 'Section Unavailable')}
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">
                {this.props.fallbackMessage || (
                  isPermissionDenied
                    ? 'You need to be signed in with the appropriate permissions to view or modify this content.'
                    : 'A temporary authentication issue prevented this section from loading. Your music session remains active.'
                )}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="w-full sm:w-auto px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} />
                <span>Try Again</span>
              </button>

              {(this.props.showSignInButton !== false) && (
                <button
                  type="button"
                  onClick={() => this.setState({ showAuthModal: true })}
                  className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
                >
                  <LogIn size={14} />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>

          <AuthModal
            isOpen={this.state.showAuthModal}
            onClose={() => this.setState({ showAuthModal: false })}
            onSuccess={() => {
              this.setState({ showAuthModal: false, hasError: false, error: null });
            }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
