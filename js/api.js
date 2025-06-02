const API_URL = "https://smartphone-backend-617681911777.us-central1.run.app";

const getAccessToken = () => localStorage.getItem("accessToken");
const getRefreshToken = () => localStorage.getItem("refreshToken");
const setTokens = ({ accessToken, refreshToken }) => {
  if (accessToken) localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
};

const logout = async () => {
  try {
    const refreshToken = getRefreshToken();
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {}
  localStorage.clear();
  window.location.href = "login.html";
};

let accessCode = null;

const requestAccessCode = () => {
  let attempts = 3;
  while (attempts > 0) {
    const code = prompt("Masukkan kode akses:");
    if (code === null) {
      // User cancel prompt
      return false;
    }
    if (code.trim() === "") {
      alert("Kode akses tidak boleh kosong.");
      attempts--;
      continue;
    }
    // Simpan kode akses yang dimasukkan
    accessCode = code.trim();
    return true;
  }
  // Jika habis 3 kali percobaan gagal
  alert("Anda gagal memasukkan kode akses yang valid.");
  return false;
};

const fetchWithAuth = async (url, options = {}) => {
  const method = (options.method || "GET").toUpperCase();

  // Tentukan apakah butuh kode akses (khusus smartphones & brands)
  const needsAccessCode =
    ["POST", "PUT", "DELETE"].includes(method) &&
    (url.includes("/smartphones") || url.includes("/brands"));

  if (needsAccessCode && !accessCode) {
    const gotCode = requestAccessCode();
    if (!gotCode) {
      alert("Kode akses diperlukan untuk melakukan operasi ini.");
      return new Response(null, { status: 499, statusText: "Kode akses dibatalkan" });
    }
  }

  // Set header dengan Authorization dan juga x-access-code jika perlu
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${getAccessToken()}`,
    ...(needsAccessCode && accessCode ? { "x-access-code": accessCode } : {}),
  };

  let res = await fetch(url, {
    ...options,
    headers,
  });

  const skipAutoRefresh = url.includes("/users/verify-password");

  // Coba refresh token jika 401 atau 403
  if (!skipAutoRefresh && (res.status === 401 || res.status === 403)) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${getAccessToken()}`,
          ...(needsAccessCode && accessCode ? { "x-access-code": accessCode } : {}),
        },
      });
    } else {
      logout();
      return;
    }

    // Jika setelah refresh tetap gagal (dan memang butuh kode akses)
    if ((res.status === 401 || res.status === 403) && needsAccessCode) {
      accessCode = null;

      const gotCodeAgain = requestAccessCode();
      if (!gotCodeAgain) {
        alert("Kode akses diperlukan untuk melanjutkan operasi.");
        return new Response(null, { status: 499, statusText: "Kode akses dibatalkan" });
      }

      res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${getAccessToken()}`,
          "x-access-code": accessCode,
        },
      });

      if (res.status === 401 || res.status === 403) {
        alert("Kode akses salah. Silakan coba lagi.");
        accessCode = null;
        return res;
      }
    }
  }

  return res;
};


const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (res.ok) {
    const data = await res.json();
    setTokens({ accessToken: data.accessToken });
    return true;
  }

  return false;
};
