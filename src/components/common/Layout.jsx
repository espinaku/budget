import {NavLink} from 'react-router-dom';
import Icon from './Icon.jsx';

const NAV_ITEMS = [
  {to : '/dashboard', label : '홈', icon : 'home'},
  {to : '/transactions', label : '거래', icon : 'list'},
  {to : '/assets', label : '자산', icon : 'wallet'},
  {to : '/settings', label : '설정', icon : 'sliders'},
];

function Layout({ children }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">가계부</span>
        <nav className="app-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 'app-nav-link' + (isActive ? ' is-active' : '')}
            >
              <Icon name={item.icon} className="app-nav-icon"/>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

export default Layout;
