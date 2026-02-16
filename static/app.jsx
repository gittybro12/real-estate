const { useEffect, useMemo, useState } = React;

const ROUTES = {
  home: "/",
  signup: "/signup",
  signin: "/signin",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  listings: "/listings",
  post: "/post",
};

const STOCK_IMAGES = [
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1593696140826-c58b021acf8b?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1600&q=80",
];

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
  });

  let data = {};
  try {
    data = await res.json();
  } catch (err) {
    data = {};
  }

  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getListingImage(listing, index = 0) {
  if (listing && listing.image_url && listing.image_url.trim()) return listing.image_url;
  const seed = ((listing?.id || 0) + index) % STOCK_IMAGES.length;
  return STOCK_IMAGES[seed];
}

function getListingIdFromPath(path) {
  const match = path.match(/^\/listing\/(\d+)$/);
  if (!match) return null;
  return Number(match[1]);
}

function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [navOpen, setNavOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotResult, setForgotResult] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [listingForm, setListingForm] = useState({
    title: "",
    description: "",
    price: "",
    city: "",
    address: "",
    property_type: "Apartment",
    bedrooms: "2",
    bathrooms: "2",
    area_sqft: "1200",
    image_url: "",
  });
  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailListing, setDetailListing] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    bootstrap();
    const onPopState = () => {
      setRoute(window.location.pathname);
      setNavOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (route === ROUTES.resetPassword) {
      const token = new URLSearchParams(window.location.search).get("token") || "";
      setResetToken(token);
    }
  }, [route]);

  async function bootstrap() {
    try {
      const [me, all] = await Promise.all([api("/api/auth/me"), api("/api/listings")]);
      const nextListings = all.listings || [];
      setUser(me.user);
      setListings(nextListings);
      setSelected(nextListings[0] || null);
      const detailId = getListingIdFromPath(window.location.pathname);
      if (detailId) {
        await loadListingDetail(detailId, nextListings);
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function navigate(to) {
    if (to === route) return;
    window.history.pushState({}, "", to);
    setRoute(to);
    setNavOpen(false);
    setMessage("");
  }

  async function loadListingDetail(listingId, knownListings = listings) {
    const local = (knownListings || []).find((item) => item.id === listingId);
    if (local) setDetailListing(local);
    setDetailLoading(true);
    try {
      const res = await api(`/api/listings/${listingId}`);
      setDetailListing(res.listing);
    } catch (err) {
      setMessage(err.message);
      setDetailListing(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshListings(query = "") {
    const result = await api(`/api/listings${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    const next = result.listings || [];
    setListings(next);
    setSelected((prev) => {
      if (!next.length) return null;
      if (!prev) return next[0];
      return next.find((l) => l.id === prev.id) || next[0];
    });
  }

  async function handleAuthSubmit(e, mode) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
      const payload = mode === "signup"
        ? { name: authForm.name, email: authForm.email, password: authForm.password }
        : { email: authForm.email, password: authForm.password };

      const res = await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
      setUser(res.user);
      setAuthForm({ name: "", email: "", password: "" });
      navigate(ROUTES.listings);
      setMessage(mode === "signup" ? "Account created." : "Signed in successfully.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignout() {
    setBusy(true);
    setMessage("");
    try {
      await api("/api/auth/signout", { method: "POST" });
      setUser(null);
      navigate(ROUTES.home);
      setMessage("Signed out.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateListing(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        ...listingForm,
        price: Number(listingForm.price),
        bedrooms: Number(listingForm.bedrooms),
        bathrooms: Number(listingForm.bathrooms),
        area_sqft: Number(listingForm.area_sqft),
      };
      const res = await api("/api/listings", { method: "POST", body: JSON.stringify(payload) });
      const next = [res.listing, ...listings];
      setListings(next);
      setSelected(res.listing);
      setListingForm({
        title: "",
        description: "",
        price: "",
        city: "",
        address: "",
        property_type: "Apartment",
        bedrooms: "2",
        bathrooms: "2",
        area_sqft: "1200",
        image_url: "",
      });
      navigate(ROUTES.listings);
      setMessage("Listing published successfully.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await refreshListings(search);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setForgotResult("");
    try {
      const res = await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotResult(res.reset_url || res.message || "If the email exists, a reset link was generated.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    if (resetPasswordValue !== resetPasswordConfirm) {
      setBusy(false);
      setMessage("Passwords do not match.");
      return;
    }
    try {
      const res = await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, password: resetPasswordValue }),
      });
      setResetPasswordValue("");
      setResetPasswordConfirm("");
      setMessage(res.message || "Password reset successful.");
      navigate(ROUTES.signin);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const listingId = getListingIdFromPath(route);
    if (!listingId) return;
    loadListingDetail(listingId);
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const avgPrice = listings.length
      ? Math.round(listings.reduce((sum, l) => sum + Number(l.price || 0), 0) / listings.length)
      : 0;
    return {
      total: listings.length,
      cities: new Set(listings.map((l) => l.city)).size,
      avgPrice,
    };
  }, [listings]);

  const onListingDetailPage = getListingIdFromPath(route) !== null;
  const isKnownRoute = Object.values(ROUTES).includes(route) || onListingDetailPage;
  const featured = listings.slice(0, 3);

  return (
    <div className="site-shell">
      <header className="topbar glass">
        <div className="brand-wrap">
          <p className="eyebrow">HavenKeys</p>
          <span className="brand-sub">Premier Real Estate</span>
        </div>
        <button
          type="button"
          className={navOpen ? "hamburger active" : "hamburger"}
          onClick={() => setNavOpen((open) => !open)}
          aria-label="Toggle navigation menu"
          aria-expanded={navOpen}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={navOpen ? "nav-links open" : "nav-links"}>
          <button className={route === ROUTES.home ? "nav-btn active" : "nav-btn"} onClick={() => navigate(ROUTES.home)}>Home</button>
          <button className={route === ROUTES.listings || onListingDetailPage ? "nav-btn active" : "nav-btn"} onClick={() => navigate(ROUTES.listings)}>Listings</button>
          <button className={route === ROUTES.post ? "nav-btn active" : "nav-btn"} onClick={() => navigate(ROUTES.post)}>Post Property</button>
          {!user && <button className={route === ROUTES.signin ? "nav-btn active" : "nav-btn"} onClick={() => navigate(ROUTES.signin)}>Sign In</button>}
          {!user && <button className={route === ROUTES.signup ? "nav-btn active" : "nav-btn"} onClick={() => navigate(ROUTES.signup)}>Sign Up</button>}
          {user && <button className="nav-btn" onClick={handleSignout} disabled={busy}>Sign Out</button>}
        </nav>
      </header>

      {message && <p className="flash">{message}</p>}

      {!isKnownRoute && (
        <section className="panel page-block">
          <h2>Page not found</h2>
          <button className="btn" onClick={() => navigate(ROUTES.home)}>Go Home</button>
        </section>
      )}

      {route === ROUTES.home && (
        <>
          <section className="hero-full" style={{ backgroundImage: `url(${getListingImage(featured[0], 0)})` }}>
            <div className="hero-overlay">
              <div className="hero-content">
                <p className="eyebrow light">Curated High-Value Listings</p>
                <h1>Buy, Rent, and Post Properties Across Verified Markets.</h1>
                <p>
                  HavenKeys helps serious buyers and sellers discover homes with accurate details, realistic imagery, and
                  direct communication with verified listing owners.
                </p>
                <div className="hero-stats">
                  <div><strong>{stats.total}</strong><span>Live Listings</span></div>
                  <div><strong>{stats.cities}</strong><span>Cities</span></div>
                  <div><strong>{money(stats.avgPrice)}</strong><span>Market Average</span></div>
                </div>
                <div className="cta-row">
                  <button className="btn" onClick={() => navigate(ROUTES.listings)}>Explore Listings</button>
                  {!user && <button className="btn secondary" onClick={() => navigate(ROUTES.signup)}>Join Now</button>}
                </div>
              </div>
            </div>
          </section>

          <section className="featured-strip">
            {(featured.length ? featured : [{ id: 0, title: "Luxury Residence", city: "Miami", price: 1250000, property_type: "Villa", bedrooms: 4, bathrooms: 3, area_sqft: 2900 }]).map((item, idx) => (
              <article key={item.id || idx} className="feature-card panel">
                <img src={getListingImage(item, idx + 1)} alt={item.title} />
                <div className="feature-body">
                  <h3>{item.title}</h3>
                  <p>{item.city} • {item.property_type}</p>
                  <div className="feature-meta">
                    <span>{item.bedrooms} beds</span>
                    <span>{item.bathrooms} baths</span>
                    <span>{item.area_sqft} sqft</span>
                  </div>
                  <strong>{money(item.price)}</strong>
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      {route === ROUTES.signup && (
        <section className="panel page-block auth-block">
          <h2>Create your account</h2>
          <form onSubmit={(e) => handleAuthSubmit(e, "signup")} className="stack">
            <label>Full Name<input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Jordan Miles" required /></label>
            <label>Email<input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" required /></label>
            <label>Password<input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="Minimum 8 characters" required minLength={8} /></label>
            <button className="btn" disabled={busy}>{busy ? "Please wait..." : "Create Account"}</button>
          </form>
        </section>
      )}

      {route === ROUTES.signin && (
        <section className="panel page-block auth-block">
          <h2>Sign in to your account</h2>
          <form onSubmit={(e) => handleAuthSubmit(e, "signin")} className="stack">
            <label>Email<input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" required /></label>
            <label>Password<input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="Your password" required minLength={8} /></label>
            <button className="btn" disabled={busy}>{busy ? "Please wait..." : "Sign In"}</button>
            <button type="button" className="text-link" onClick={() => navigate(ROUTES.forgotPassword)}>Forgot password?</button>
          </form>
        </section>
      )}

      {route === ROUTES.forgotPassword && (
        <section className="panel page-block auth-block">
          <h2>Forgot Password</h2>
          <form onSubmit={handleForgotPassword} className="stack">
            <label>Email<input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" required /></label>
            <button className="btn" disabled={busy}>{busy ? "Generating..." : "Generate Reset Link"}</button>
          </form>
          {forgotResult && (
            <p className="hint">
              Reset link: <a href={forgotResult}>{forgotResult}</a>
            </p>
          )}
        </section>
      )}

      {route === ROUTES.resetPassword && (
        <section className="panel page-block auth-block">
          <h2>Reset Password</h2>
          <form onSubmit={handleResetPassword} className="stack">
            <label>Reset Token<input value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Paste your reset token" required /></label>
            <label>New Password<input type="password" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} placeholder="Minimum 8 characters" minLength={8} required /></label>
            <label>Confirm Password<input type="password" value={resetPasswordConfirm} onChange={(e) => setResetPasswordConfirm(e.target.value)} placeholder="Confirm password" minLength={8} required /></label>
            <button className="btn" disabled={busy}>{busy ? "Resetting..." : "Reset Password"}</button>
          </form>
        </section>
      )}

      {route === ROUTES.listings && (
        <section className="main-grid full-page-grid">
          <aside className="panel listings-panel">
            <div className="listings-top">
              <h2>Listings</h2>
              <form onSubmit={handleSearch} className="search-row">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search city, title, type" />
                <button className="btn tiny" disabled={busy}>Search</button>
              </form>
            </div>

            {loading ? (
              <p className="muted">Loading listings...</p>
            ) : listings.length === 0 ? (
              <p className="muted">No listings yet.</p>
            ) : (
              <ul className="listing-list">
                {listings.map((item, idx) => (
                  <li key={item.id}>
                    <button className={selected && selected.id === item.id ? "listing-item active" : "listing-item"} onClick={() => setSelected(item)}>
                      <img className="listing-thumb" src={getListingImage(item, idx + 2)} alt={item.title} />
                      <div className="listing-copy">
                        <p className="listing-title">{item.title}</p>
                        <p className="muted small">{item.city} • {item.property_type}</p>
                        <strong>{money(item.price)}</strong>
                        <span className="listing-link" onClick={(e) => { e.stopPropagation(); navigate(`/listing/${item.id}`); }}>
                          View details
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <article className="panel details-panel full-height">
            {selected ? (
              <>
                <div className="image-wrap tall">
                  <img src={getListingImage(selected, 3)} alt={selected.title} />
                </div>
                <div className="detail-body">
                  <p className="muted small">Listed by {selected.owner_name}</p>
                  <h2>{selected.title}</h2>
                  <p className="price">{money(selected.price)}</p>
                  <p>{selected.description}</p>
                  <div className="facts">
                    <span>{selected.bedrooms} beds</span>
                    <span>{selected.bathrooms} baths</span>
                    <span>{selected.area_sqft} sqft</span>
                    <span>{selected.property_type}</span>
                  </div>
                  <p className="muted">{selected.address}, {selected.city}</p>
                </div>
              </>
            ) : (
              <div className="detail-body"><p className="muted">Select a listing to view details.</p></div>
            )}
          </article>
        </section>
      )}

      {onListingDetailPage && (
        <section className="panel detail-page">
          {detailLoading ? (
            <div className="detail-body"><p className="muted">Loading listing...</p></div>
          ) : !detailListing ? (
            <div className="detail-body">
              <h2>Listing not found</h2>
              <p className="muted">The property may have been removed.</p>
              <button className="btn" onClick={() => navigate(ROUTES.listings)}>Back to Listings</button>
            </div>
          ) : (
            <>
              <div className="detail-hero-image">
                <img src={getListingImage(detailListing, 4)} alt={detailListing.title} />
              </div>
              <div className="detail-layout">
                <article className="detail-main">
                  <p className="muted small">Listed by {detailListing.owner_name}</p>
                  <h2>{detailListing.title}</h2>
                  <p className="price">{money(detailListing.price)}</p>
                  <p>{detailListing.description}</p>
                  <div className="facts">
                    <span>{detailListing.bedrooms} beds</span>
                    <span>{detailListing.bathrooms} baths</span>
                    <span>{detailListing.area_sqft} sqft</span>
                    <span>{detailListing.property_type}</span>
                  </div>
                  <p className="muted">{detailListing.address}, {detailListing.city}</p>
                </article>
                <aside className="detail-side panel">
                  <h3>Property Snapshot</h3>
                  <p><strong>Price:</strong> {money(detailListing.price)}</p>
                  <p><strong>Type:</strong> {detailListing.property_type}</p>
                  <p><strong>Bedrooms:</strong> {detailListing.bedrooms}</p>
                  <p><strong>Bathrooms:</strong> {detailListing.bathrooms}</p>
                  <p><strong>Area:</strong> {detailListing.area_sqft} sqft</p>
                  <p><strong>City:</strong> {detailListing.city}</p>
                  <button className="btn full" onClick={() => navigate(ROUTES.listings)}>Back to Listings</button>
                </aside>
              </div>
            </>
          )}
        </section>
      )}

      {route === ROUTES.post && (
        <section className="panel page-block post-panel">
          <h2>Post Real Estate</h2>
          {!user ? (
            <div>
              <p className="muted">You must sign in before posting a listing.</p>
              <button className="btn" onClick={() => navigate(ROUTES.signin)}>Go to Sign In</button>
            </div>
          ) : (
            <form className="post-grid" onSubmit={handleCreateListing}>
              <label>Title<input value={listingForm.title} onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })} required /></label>
              <label>Price (USD)<input type="number" min="1" value={listingForm.price} onChange={(e) => setListingForm({ ...listingForm, price: e.target.value })} required /></label>
              <label>City<input value={listingForm.city} onChange={(e) => setListingForm({ ...listingForm, city: e.target.value })} required /></label>
              <label>Address<input value={listingForm.address} onChange={(e) => setListingForm({ ...listingForm, address: e.target.value })} required /></label>
              <label>Property Type
                <select value={listingForm.property_type} onChange={(e) => setListingForm({ ...listingForm, property_type: e.target.value })}>
                  <option>Apartment</option><option>House</option><option>Condo</option><option>Villa</option><option>Townhome</option>
                </select>
              </label>
              <label>Bedrooms<input type="number" min="0" value={listingForm.bedrooms} onChange={(e) => setListingForm({ ...listingForm, bedrooms: e.target.value })} required /></label>
              <label>Bathrooms<input type="number" min="0" step="0.5" value={listingForm.bathrooms} onChange={(e) => setListingForm({ ...listingForm, bathrooms: e.target.value })} required /></label>
              <label>Area (sqft)<input type="number" min="1" value={listingForm.area_sqft} onChange={(e) => setListingForm({ ...listingForm, area_sqft: e.target.value })} required /></label>
              <label className="full">Image URL<input value={listingForm.image_url} onChange={(e) => setListingForm({ ...listingForm, image_url: e.target.value })} placeholder="https://..." /></label>
              <label className="full">Description<textarea value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })} rows="4" required /></label>
              <button className="btn full" disabled={busy}>{busy ? "Publishing..." : "Publish Listing"}</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
