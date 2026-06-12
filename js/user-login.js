function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const pass = document.getElementById('password').value.trim();
  const error = document.getElementById('loginError');
  const storedApiHost = localStorage.getItem('apiHost');
  const API_HOST = !storedApiHost || ['http://127.0.0.1:5000', 'http://localhost:5000'].includes(storedApiHost)
    ? 'http://127.0.0.1:5001'
    : storedApiHost;
  const BASE_URL = `${API_HOST}/api`;

  if (!email || !pass) {
    error.textContent = "Please fill all fields.";
    return;
  }

  error.textContent = "";

  fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass })
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }
      localStorage.setItem('apiHost', API_HOST);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      window.location.href = 'user-dashboard.html';
    })
    .catch((err) => {
      error.textContent = err.message || 'Unable to connect to backend.';
    });
}
