import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    if (window.confirm("Sei sicuro? Questo cancellerà tutti i dati salvati in locale.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-200 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-red-900/50 rounded-2xl p-8 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-red-900/20 p-4 rounded-full text-red-500 mb-4">
                <AlertTriangle size={48} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Qualcosa è andato storto</h1>
              <p className="text-slate-400 text-sm">
                L'applicazione ha riscontrato un errore critico.
              </p>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 mb-6 border border-slate-800 overflow-auto max-h-64 text-left scrollbar-thin scrollbar-thumb-slate-700">
              <p className="text-red-400 font-mono text-xs break-words whitespace-pre-wrap font-bold mb-2">
                {this.state.error?.toString()}
              </p>
              {this.state.errorInfo && (
                <p className="text-slate-600 font-mono text-[10px] break-words whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={20} /> Riprova
              </button>
              
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-slate-800 hover:bg-red-900/20 text-red-400 hover:text-red-300 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-slate-700 hover:border-red-900/50"
              >
                <Trash2 size={20} /> Reset Dati (Emergenza)
              </button>
            </div>
            
            <p className="text-xs text-slate-600 mt-6 text-center">
              Copia il log sopra se devi segnalare il bug. <br/>
              Usa "Reset Dati" se l'app continua a crashare dopo il riavvio.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}