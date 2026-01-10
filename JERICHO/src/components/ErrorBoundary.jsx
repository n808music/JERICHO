import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('UI ErrorBoundary caught error:', error, info);
    }
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen bg-jericho-bg text-jericho-text flex items-center justify-center p-6">
        <div className="max-w-2xl w-full rounded-xl border border-line/60 bg-jericho-surface p-4 space-y-2">
          <p className="text-sm font-semibold text-jericho-text">UI Error</p>
          <p className="text-xs text-muted">{error.message || 'Unexpected render error.'}</p>
          {process.env.NODE_ENV !== 'production' && info?.componentStack ? (
            <pre className="text-[11px] text-muted whitespace-pre-wrap">{info.componentStack}</pre>
          ) : null}
        </div>
      </div>
    );
  }
}
