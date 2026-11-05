import { render } from 'preact';
import { App } from './ui/App';
import { initTheme } from './ui/state/theme';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/feedback.css';
import './styles/keyboard.css';
import './styles/pages.css';
import './styles/editors.css';

initTheme();
render(<App />, document.getElementById('app')!);
