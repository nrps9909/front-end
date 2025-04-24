import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';

function AppNavbar({ onSelectView, currentView }) {
  return (
    <Navbar bg="light" expand="lg" sticky="top" className="shadow-sm">
      <Container>
        <Navbar.Brand href="#" onClick={(e) => {e.preventDefault(); onSelectView('training');}}>
          WingChat ✨
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link onClick={() => onSelectView('training')} active={currentView === 'training'}>💬 訓練室</Nav.Link>
            <Nav.Link onClick={() => onSelectView('characters')} active={currentView === 'characters'}>🎭 角色館</Nav.Link>
            <Nav.Link onClick={() => onSelectView('feedback')} active={currentView === 'feedback'}>📊 回饋牆</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default AppNavbar;