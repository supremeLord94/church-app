import { Component } from 'react';

// Catches a crash while drawing a page and shows a message instead of a blank screen.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="login">
        <div className="card form-card">
          <h1>Algo salió mal</h1>
          <p className="muted">Esta pantalla tuvo un error. Tus datos están seguros. Recarga la página; si sigue igual, avisa a un administrador y dile qué estabas haciendo.</p>
          <p className="small error">{String(this.state.error?.message || this.state.error)}</p>
          <button className="primary" onClick={() => window.location.assign('/')}>Volver al inicio</button>
        </div>
      </div>
    );
  }
}
