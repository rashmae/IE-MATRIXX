import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class FirebaseErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: any) {
    if (error?.message?.includes('VITE_FIREBASE_DATABASE_ID') || 
        error?.message?.includes('client is offline') ||
        error?.message?.includes('not found')) {
      return { hasError: true, errorMessage: error.message };
    }
    return { hasError: false, errorMessage: '' };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[Firebase Error Boundary]', error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md w-full space-y-8"
          >
            {/* Robot Mascot Placeholder - Using a stylized icon with amber theme */}
            <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
              <div className="absolute inset-0 bg-ctu-gold/20 rounded-full animate-pulse" />
              <AlertCircle size={64} className="text-ctu-gold relative z-10" />
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Connection Issue</h1>
              <p className="text-foreground/60 text-lg leading-relaxed">
                Unable to connect to the database. Please check your internet connection and verify your environment variables.
              </p>
              {this.state.errorMessage && (
                <div className="p-4 bg-ctu-maroon/5 border border-ctu-maroon/20 rounded-xl text-ctu-maroon/80 text-sm font-mono break-all">
                  {this.state.errorMessage}
                </div>
              )}
            </div>

            <Button
              onClick={this.handleRetry}
              className="bg-ctu-gold hover:bg-ctu-gold/90 text-white font-bold px-8 h-12 rounded-2xl flex items-center gap-2 mx-auto transition-transform hover:scale-105 active:scale-95"
            >
              <RefreshCw size={20} />
              Retry Connection
            </Button>

            <p className="text-xs text-foreground/30 font-medium">
              If the problem persists, please contact your administrator.
            </p>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
