import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

// Using ReactDOM.render (React 16/17 style)
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

/* 
// To upgrade to React 18, replace the above with:
import { createRoot } from 'react-dom/client';
const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
*/
