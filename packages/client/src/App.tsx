import { FormEvent, useEffect, useMemo, useState } from "react";

type AppView = "home" | "book" | "locations" | "passes" | "me";
type AuthMode = "login" | "signup" | "reset";
type BookingStatus = "confirmed" | "waitlist" | "cancelled" | "checked-in";
type PaymentStatus = "paid" | "refunded";
type Channel = "push" | "email" | "sms";

type SessionType = {
  id: string;
  name: string;
  duration: number;
  price: number;
  benefits: string[];
};

type Session = {
  id: string;
  typeId: string;
  date: string;
  time: string;
  capacity: number;
  practitioner: string;
};

type Booking = {
  id: string;
  sessionId: string;
  customerId: string;
  customerName: string;
  status: BookingStatus;
  paid: number;
  createdAt: string;
  paymentId?: string;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  membershipId: string;
  credits: number;
  paymentMethod: string;
};

type MembershipPlan = {
  id: string;
  name: string;
  price: number;
  credits: number;
  perks: string[];
};

type Transaction = {
  id: string;
  bookingId: string;
  amount: number;
  status: PaymentStatus;
  method: string;
  date: string;
};

type Notice = {
  id: string;
  channel: Channel;
  title: string;
  body: string;
};

type Location = {
  id: string;
  name: string;
  address: string;
  hours: string;
  image: string;
  facilities: string[];
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PersistedAppState = {
  bookings: Booking[];
  customers: Customer[];
  isAuthenticated: boolean;
  notices: Notice[];
  selectedCustomerId: string;
  transactions: Transaction[];
  view: AppView;
};

const sessionTypes: SessionType[] = [
  {
    id: "thermal",
    name: "Bathhouse Access",
    duration: 90,
    price: 58,
    benefits: ["Traditional sauna", "Cold plunge", "Steam room"]
  },
  {
    id: "recovery",
    name: "Contrast Therapy",
    duration: 60,
    price: 42,
    benefits: ["Sauna bench", "Ice bath", "Recovery lounge"]
  },
  {
    id: "ritual",
    name: "Evening Bathhouse",
    duration: 120,
    price: 86,
    benefits: ["Extended access", "Steam", "Quiet room"]
  }
];

const initialSessions: Session[] = [
  { id: "s1", typeId: "thermal", date: "2026-05-24", time: "09:00", capacity: 8, practitioner: "Mara" },
  { id: "s2", typeId: "recovery", date: "2026-05-24", time: "11:30", capacity: 6, practitioner: "Sofia" },
  { id: "s3", typeId: "thermal", date: "2026-05-24", time: "14:00", capacity: 2, practitioner: "Niko" },
  { id: "s4", typeId: "ritual", date: "2026-05-25", time: "18:00", capacity: 10, practitioner: "Ari" },
  { id: "s5", typeId: "recovery", date: "2026-05-26", time: "08:30", capacity: 7, practitioner: "Mara" }
];

const plans: MembershipPlan[] = [
  {
    id: "drop-in",
    name: "Drop In",
    price: 0,
    credits: 0,
    perks: ["Pay per session", "Stored receipts", "Waitlist access"]
  },
  {
    id: "flow",
    name: "Flow",
    price: 149,
    credits: 4,
    perks: ["4 monthly credits", "Priority waitlist", "10% off extras"]
  },
  {
    id: "restore",
    name: "Restore",
    price: 279,
    credits: 9,
    perks: ["9 monthly credits", "Guest pass", "Free plan changes"]
  }
];

const initialCustomers: Customer[] = [
  {
    id: "c1",
    name: "Shane Goodhew",
    email: "shane@example.com",
    phone: "+61 400 100 200",
    membershipId: "flow",
    credits: 2,
    paymentMethod: "Visa token ending 4242"
  },
  {
    id: "c2",
    name: "Jon Bell",
    email: "jon@example.com",
    phone: "+61 400 300 500",
    membershipId: "drop-in",
    credits: 0,
    paymentMethod: "Mastercard token ending 1881"
  },
  {
    id: "c3",
    name: "Mia Chen",
    email: "mia@example.com",
    phone: "+61 411 222 333",
    membershipId: "restore",
    credits: 5,
    paymentMethod: "Apple Pay token ending 9001"
  }
];

const initialBookings: Booking[] = [
  {
    id: "b1",
    sessionId: "s1",
    customerId: "c2",
    customerName: "Jon Bell",
    status: "confirmed",
    paid: 58,
    createdAt: "2026-05-23T09:00:00",
    paymentId: "txn-1001"
  },
  {
    id: "b2",
    sessionId: "s3",
    customerId: "c3",
    customerName: "Mia Chen",
    status: "confirmed",
    paid: 0,
    createdAt: "2026-05-22T14:00:00",
    paymentId: "txn-1002"
  },
  {
    id: "b3",
    sessionId: "s3",
    customerId: "c2",
    customerName: "Jon Bell",
    status: "confirmed",
    paid: 58,
    createdAt: "2026-05-23T18:00:00",
    paymentId: "txn-1003"
  }
];

const initialTransactions: Transaction[] = [
  { id: "txn-1001", bookingId: "b1", amount: 58, status: "paid", method: "Visa token ending 4242", date: "2026-05-23" },
  { id: "txn-1002", bookingId: "b2", amount: 0, status: "paid", method: "Membership credit", date: "2026-05-22" },
  { id: "txn-1003", bookingId: "b3", amount: 58, status: "paid", method: "Mastercard token ending 1881", date: "2026-05-23" }
];

const initialNotices: Notice[] = [
  {
    id: "n1",
    channel: "push",
    title: "Session reminder",
    body: "Thermal Circuit begins tomorrow at 9:00."
  },
  {
    id: "n2",
    channel: "email",
    title: "Receipt generated",
    body: "Receipt txn-1001 was emailed to Jon Bell."
  }
];

const locations: Location[] = [
  {
    id: "scarborough",
    name: "Clave Scarborough",
    address: "West Coast Highway, Scarborough WA",
    hours: "6:00am - 9:00pm",
    image: "https://img1.wsimg.com/isteam/getty/1451246460",
    facilities: ["Finnish sauna", "Cold plunge", "Steam room", "Recovery lounge", "Tea bar"]
  },
  {
    id: "fremantle",
    name: "Clave Fremantle",
    address: "Market Street, Fremantle WA",
    hours: "7:00am - 8:00pm",
    image: "https://img1.wsimg.com/isteam/getty/1451246460",
    facilities: ["Cedar sauna", "Ice bath", "Warm soak", "Outdoor rinse"]
  }
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
}

function getSessionType(typeId: string) {
  return sessionTypes.find((type) => type.id === typeId) ?? sessionTypes[0];
}

function getPlan(planId: string) {
  return plans.find((plan) => plan.id === planId) ?? plans[0];
}

function activeBookingsFor(sessionId: string, bookings: Booking[]) {
  return bookings.filter((booking) => booking.sessionId === sessionId && ["confirmed", "checked-in"].includes(booking.status));
}

function waitlistFor(sessionId: string, bookings: Booking[]) {
  return bookings.filter((booking) => booking.sessionId === sessionId && booking.status === "waitlist");
}

function readPersistedState(): Partial<PersistedAppState> {
  try {
    const stored = window.localStorage.getItem("clave-app-state");
    return stored ? (JSON.parse(stored) as Partial<PersistedAppState>) : {};
  } catch {
    return {};
  }
}

export function App() {
  const persistedState = useMemo(() => readPersistedState(), []);
  const [view, setView] = useState<AppView>(persistedState.view ?? "home");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isAuthenticated, setIsAuthenticated] = useState(persistedState.isAuthenticated ?? false);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [bookings, setBookings] = useState<Booking[]>(persistedState.bookings ?? initialBookings);
  const [customers, setCustomers] = useState<Customer[]>(persistedState.customers ?? initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>(persistedState.transactions ?? initialTransactions);
  const [notices, setNotices] = useState<Notice[]>(persistedState.notices ?? initialNotices);
  const [selectedCustomerId, setSelectedCustomerId] = useState(persistedState.selectedCustomerId ?? "c1");
  const [selectedDate, setSelectedDate] = useState("2026-05-24");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedSessions, setSelectedSessions] = useState<string[]>(["s2"]);
  const [profileName, setProfileName] = useState("Shane Goodhew");
  const [profilePhone, setProfilePhone] = useState("+61 400 100 200");
  const [authName, setAuthName] = useState("Shane Goodhew");
  const [authEmail, setAuthEmail] = useState("shane@example.com");
  const [authPassword, setAuthPassword] = useState("");
  const [authPhone, setAuthPhone] = useState("+61 400 100 200");
  const [authMessage, setAuthMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pwaMessage, setPwaMessage] = useState("Offline-ready after first load.");
  const [newCapacity, setNewCapacity] = useState(8);
  const [newTypeId, setNewTypeId] = useState("thermal");
  const [newDate, setNewDate] = useState("2026-05-27");
  const [newTime, setNewTime] = useState("16:00");

  const currentCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0];
  const currentPlan = getPlan(currentCustomer.membershipId);

  const visibleSessions = useMemo(
    () =>
      sessions.filter((session) => {
        const matchesDate = session.date === selectedDate;
        const matchesType = selectedType === "all" || session.typeId === selectedType;
        return matchesDate && matchesType;
      }),
    [selectedDate, selectedType, sessions]
  );

  const customerBookings = bookings.filter((booking) => booking.customerId === currentCustomer.id);
  const revenue = transactions.filter((transaction) => transaction.status === "paid").reduce((sum, transaction) => sum + transaction.amount, 0);
  const occupancy =
    sessions.reduce((sum, session) => sum + activeBookingsFor(session.id, bookings).length / session.capacity, 0) / Math.max(sessions.length, 1);

  useEffect(() => {
    const nextState: PersistedAppState = {
      bookings,
      customers,
      isAuthenticated,
      notices,
      selectedCustomerId,
      transactions,
      view
    };
    window.localStorage.setItem("clave-app-state", JSON.stringify(nextState));
  }, [bookings, customers, isAuthenticated, notices, selectedCustomerId, transactions, view]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
    setIsStandalone(mediaQuery.matches || Boolean(standaloneNavigator.standalone));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setPwaMessage("Ready to install on this device.");
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      setPwaMessage("Installed. Clave is ready from your home screen.");
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function pushNotice(channel: Channel, title: string, body: string) {
    setNotices((current) => [{ id: `n${Date.now()}`, channel, title, body }, ...current].slice(0, 8));
  }

  async function handleInstallApp() {
    if (!installPrompt) {
      setPwaMessage(isStandalone ? "Already installed on this device." : "Use your browser menu to add Clave to your home screen.");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setPwaMessage(choice.outcome === "accepted" ? "Install started." : "Install dismissed. You can try again later.");
  }

  function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authMode === "reset") {
      setAuthMessage(`Password reset link sent to ${authEmail}.`);
      pushNotice("email", "Password reset", `A secure reset link was sent to ${authEmail}.`);
      return;
    }

    if (!authEmail || !authPassword) {
      setAuthMessage("Enter an email and password to continue.");
      return;
    }

    if (authMode === "login") {
      const existing = customers.find((customer) => customer.email.toLowerCase() === authEmail.toLowerCase());
      if (!existing) {
        setAuthMessage("No account found for that email. Create one to continue.");
        return;
      }

      setSelectedCustomerId(existing.id);
      setProfileName(existing.name);
      setProfilePhone(existing.phone);
      setIsAuthenticated(true);
      setAuthMessage("");
      pushNotice("push", "Welcome back", `${existing.name} signed in.`);
      return;
    }

    if (!authName.trim()) {
      setAuthMessage("Enter your name to create an account.");
      return;
    }

    const newCustomer: Customer = {
      id: `c${Date.now()}`,
      name: authName.trim(),
      email: authEmail.trim(),
      phone: authPhone.trim(),
      membershipId: "drop-in",
      credits: 0,
      paymentMethod: "Payment token pending"
    };

    setCustomers((current) => [newCustomer, ...current]);
    setSelectedCustomerId(newCustomer.id);
    setProfileName(newCustomer.name);
    setProfilePhone(newCustomer.phone);
    setIsAuthenticated(true);
    setAuthMessage("");
    pushNotice("email", "Account created", `Welcome to Clave Bathhouse, ${newCustomer.name}.`);
  }

  function handleSocialAuth(provider: "Apple" | "Google") {
    const existing = customers.find((customer) => customer.email.toLowerCase() === authEmail.toLowerCase()) ?? customers[0];

    setSelectedCustomerId(existing.id);
    setProfileName(existing.name);
    setProfilePhone(existing.phone);
    setIsAuthenticated(true);
    setAuthMode("login");
    setAuthMessage("");
    pushNotice("push", `${provider} sign in`, `${existing.name} signed in with ${provider}.`);
  }

  function handleSignOut() {
    setIsAuthenticated(false);
    setAuthMode("login");
    setAuthPassword("");
    setView("home");
  }

  function allocateWaitlist(sessionId: string, nextBookings: Booking[]) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return nextBookings;

    const activeCount = activeBookingsFor(sessionId, nextBookings).length;
    if (activeCount >= session.capacity) return nextBookings;

    const nextWaitlist = waitlistFor(sessionId, nextBookings)[0];
    if (!nextWaitlist) return nextBookings;

    pushNotice("push", "Waitlist confirmed", `${nextWaitlist.customerName} was moved into ${getSessionType(session.typeId).name}.`);
    return nextBookings.map((booking) =>
      booking.id === nextWaitlist.id ? { ...booking, status: "confirmed" as const, paymentId: booking.paymentId ?? `txn-${Date.now()}` } : booking
    );
  }

  function handleCheckout() {
    if (selectedSessions.length === 0) {
      pushNotice("push", "Choose a time", "Select at least one bathhouse spot before checkout.");
      return;
    }

    let nextCredits = currentCustomer.credits;
    const createdBookings: Booking[] = [];
    const createdTransactions: Transaction[] = [];

    for (const sessionId of selectedSessions) {
      const session = sessions.find((item) => item.id === sessionId);
      if (!session) continue;

      const type = getSessionType(session.typeId);
      const full = activeBookingsFor(sessionId, bookings.concat(createdBookings)).length >= session.capacity;
      const useCredit = !full && nextCredits > 0;
      const amount = full || useCredit ? 0 : type.price;
      const bookingId = `b${Date.now()}-${sessionId}`;
      const status: BookingStatus = full ? "waitlist" : "confirmed";

      if (useCredit) nextCredits -= 1;

      createdBookings.push({
        id: bookingId,
        sessionId,
        customerId: currentCustomer.id,
        customerName: currentCustomer.name,
        status,
        paid: amount,
        createdAt: new Date().toISOString(),
        paymentId: status === "confirmed" ? `txn-${Date.now()}-${sessionId}` : undefined
      });

      if (status === "confirmed") {
        createdTransactions.push({
          id: `txn-${Date.now()}-${sessionId}`,
          bookingId,
          amount,
          status: "paid",
          method: useCredit ? "Membership credit" : currentCustomer.paymentMethod,
          date: "2026-05-24"
        });
      }
    }

    setBookings((current) => createdBookings.concat(current));
    setTransactions((current) => createdTransactions.concat(current));
    setCustomers((current) => current.map((customer) => (customer.id === currentCustomer.id ? { ...customer, credits: nextCredits } : customer)));
    setSelectedSessions([]);
    pushNotice("email", "Booking confirmation", "Your Clave Bathhouse itinerary and receipt are ready.");
  }

  function cancelBooking(bookingId: string) {
    const target = bookings.find((booking) => booking.id === bookingId);
    if (!target) return;

    const session = sessions.find((item) => item.id === target.sessionId);
    if (!session) return;

    const sessionStart = new Date(`${session.date}T${session.time}:00`);
    const policyDeadline = new Date("2026-05-24T00:00:00");
    if (sessionStart.getTime() - policyDeadline.getTime() < 6 * 60 * 60 * 1000) {
      pushNotice("sms", "Cancellation blocked", "This booking is inside the six hour cancellation window.");
      return;
    }

    setBookings((current) => allocateWaitlist(target.sessionId, current.map((booking) => (booking.id === bookingId ? { ...booking, status: "cancelled" } : booking))));
    pushNotice("email", "Booking cancelled", `${target.customerName}'s booking was cancelled and policy rules were applied.`);
  }

  function checkIn(bookingId: string) {
    setBookings((current) => current.map((booking) => (booking.id === bookingId ? { ...booking, status: "checked-in" } : booking)));
    pushNotice("push", "Check-in complete", "Attendance has been updated for the bathhouse.");
  }

  function subscribe(planId: string) {
    const plan = getPlan(planId);
    setCustomers((current) =>
      current.map((customer) =>
        customer.id === currentCustomer.id
          ? { ...customer, membershipId: planId, credits: plan.credits, paymentMethod: customer.paymentMethod || "Payment token pending" }
          : customer
      )
    );
    setTransactions((current) => [
      { id: `txn-${Date.now()}`, bookingId: "membership-renewal", amount: plan.price, status: "paid", method: currentCustomer.paymentMethod, date: "2026-05-24" },
      ...current
    ]);
    pushNotice("email", "Membership updated", `${plan.name} billing is active with proration queued for the provider.`);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCustomers((current) => current.map((customer) => (customer.id === currentCustomer.id ? { ...customer, name: profileName, phone: profilePhone } : customer)));
    pushNotice("push", "Profile saved", "Personal details were updated.");
  }

  function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session: Session = {
      id: `s${Date.now()}`,
      typeId: newTypeId,
      date: newDate,
      time: newTime,
      capacity: newCapacity,
      practitioner: "Clave Team"
    };
    setSessions((current) => [...current, session].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
    pushNotice("email", "Schedule updated", `${getSessionType(newTypeId).name} was added to the live timetable.`);
  }

  function refund(transactionId: string) {
    setTransactions((current) => current.map((transaction) => (transaction.id === transactionId ? { ...transaction, status: "refunded" } : transaction)));
    pushNotice("email", "Refund issued", `Refund ${transactionId} has been sent to the payment provider.`);
  }

  return (
    <main className="clave-app">
      <section className="mobile-showcase">
        <div className="site-note">
          <p className="eyebrow">Clave Bathhouse</p>
          <h1>Relax, Refresh, Rejuvenate</h1>
          <p>
            A mobile-first booking app inspired by Clave's website: calm editorial
            type, warm neutrals, spa photography, and a simple path from browse to
            confirmed visit.
          </p>
        </div>

        <div className="phone-shell" aria-label="Clave Bathhouse mobile app preview">
          <div className="phone-status">
            <span>9:41</span>
            <span>Clave</span>
          </div>
          <header className="app-hero">
            <div className="hero-image" aria-hidden="true">
              <div className="hero-mist" />
            </div>
            <div className="hero-copy">
              <p className="eyebrow">Clave Bathhouse</p>
              <h2>Relax, Refresh, Rejuvenate</h2>
              <p>Reserve sauna, steam, plunge, and recovery spots in a few taps.</p>
            </div>
          </header>

          {!isAuthenticated ? (
            <AuthWorkspace
              authEmail={authEmail}
              authMessage={authMessage}
              authMode={authMode}
              authName={authName}
              authPassword={authPassword}
              authPhone={authPhone}
              handleAuth={handleAuth}
              handleSocialAuth={handleSocialAuth}
              setAuthEmail={setAuthEmail}
              setAuthMode={setAuthMode}
              setAuthName={setAuthName}
              setAuthPassword={setAuthPassword}
              setAuthPhone={setAuthPhone}
            />
          ) : (
            <>
              <section className="app-scroll">
                {view === "home" && (
              <HomeWorkspace
                bookings={customerBookings}
                currentCustomer={currentCustomer}
                installPromptReady={Boolean(installPrompt)}
                isOnline={isOnline}
                isStandalone={isStandalone}
                onInstallApp={handleInstallApp}
                pwaMessage={pwaMessage}
                setView={setView}
                sessions={sessions}
              />
                )}

                {view === "book" && (
              <CustomerWorkspace
                bookings={customerBookings}
                cancelBooking={cancelBooking}
                currentCustomer={currentCustomer}
                handleCheckout={handleCheckout}
                profileName={profileName}
                profilePhone={profilePhone}
                saveProfile={saveProfile}
                selectedDate={selectedDate}
                selectedSessions={selectedSessions}
                selectedType={selectedType}
                sessions={visibleSessions}
                setProfileName={setProfileName}
                setProfilePhone={setProfilePhone}
                setSelectedDate={setSelectedDate}
                setSelectedSessions={setSelectedSessions}
                setSelectedType={setSelectedType}
                subscribe={subscribe}
                allBookings={bookings}
              />
                )}

                {view === "locations" && <LocationsWorkspace locations={locations} setView={setView} />}

                {view === "passes" && (
              <PassesWorkspace currentCustomer={currentCustomer} subscribe={subscribe} />
                )}

                {view === "me" && (
              <ProfileWorkspace
                bookings={customerBookings}
                cancelBooking={cancelBooking}
                currentCustomer={currentCustomer}
                handleSignOut={handleSignOut}
                notices={notices}
                profileName={profileName}
                profilePhone={profilePhone}
                saveProfile={saveProfile}
                setProfileName={setProfileName}
                setProfilePhone={setProfilePhone}
                sessions={sessions}
              />
                )}
              </section>
              <nav className="bottom-nav" aria-label="Primary mobile navigation">
                {(["home", "book", "locations", "passes", "me"] as AppView[]).map((item) => (
                  <button className={view === item ? "active" : ""} key={item} onClick={() => setView(item)}>
                    <NavIcon view={item} />
                    <span>{item}</span>
                  </button>
                ))}
              </nav>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function AuthWorkspace({
  authEmail,
  authMessage,
  authMode,
  authName,
  authPassword,
  authPhone,
  handleAuth,
  handleSocialAuth,
  setAuthEmail,
  setAuthMode,
  setAuthName,
  setAuthPassword,
  setAuthPhone
}: {
  authEmail: string;
  authMessage: string;
  authMode: AuthMode;
  authName: string;
  authPassword: string;
  authPhone: string;
  handleAuth: (event: FormEvent<HTMLFormElement>) => void;
  handleSocialAuth: (provider: "Apple" | "Google") => void;
  setAuthEmail: (value: string) => void;
  setAuthMode: (mode: AuthMode) => void;
  setAuthName: (value: string) => void;
  setAuthPassword: (value: string) => void;
  setAuthPhone: (value: string) => void;
}) {
  const title = authMode === "signup" ? "Create your account" : authMode === "reset" ? "Reset password" : "Welcome back";
  const action = authMode === "signup" ? "Create account" : authMode === "reset" ? "Send reset link" : "Sign in";

  return (
    <section className="auth-screen">
      <div className="auth-card">
        <p className="eyebrow">Member access</p>
        <h3>{title}</h3>
        <p>
          {authMode === "signup"
            ? "Save your details, payment method, vouchers, and bathhouse bookings."
            : authMode === "reset"
              ? "Enter your account email and we will send a secure reset link."
              : "Sign in to book spots, manage passes, and view your next visit."}
        </p>

        <form className="auth-form" onSubmit={handleAuth}>
          {authMode === "signup" && (
            <>
              <label>
                Name
                <input autoComplete="name" value={authName} onChange={(event) => setAuthName(event.target.value)} />
              </label>
              <label>
                Phone
                <input autoComplete="tel" value={authPhone} onChange={(event) => setAuthPhone(event.target.value)} />
              </label>
            </>
          )}

          <label>
            Email
            <input autoComplete="email" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
          </label>

          {authMode !== "reset" && (
            <label>
              Password
              <input
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </label>
          )}

          {authMessage && <p className="auth-message">{authMessage}</p>}
          <button>{action}</button>
        </form>

        <div className="social-auth">
          <button onClick={() => handleSocialAuth("Apple")} type="button">
            <AppleIcon />
            <span>Apple</span>
          </button>
          <button onClick={() => handleSocialAuth("Google")} type="button">
            <GoogleIcon />
            <span>Google</span>
          </button>
        </div>

        <div className="auth-links">
          {authMode !== "login" && <button onClick={() => setAuthMode("login")}>Back to login</button>}
          {authMode !== "signup" && <button onClick={() => setAuthMode("signup")}>Create account</button>}
          {authMode !== "reset" && <button onClick={() => setAuthMode("reset")}>Forgot password</button>}
        </div>
      </div>
    </section>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" className="brand-icon" viewBox="0 0 24 24">
      <path
        d="M16.7 12.4c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.5-.4 6.3 1.1 8.3.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1 2.6-2 .8-1.2 1.1-2.3 1.2-2.3 0-.1-2.5-1-2.5-3.4ZM14.7 6.2c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.6.9.1 1.9-.5 2.5-1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="brand-icon" viewBox="0 0 24 24">
      <path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.7 3-4.2 3-7Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5- .9 6.6-2.5l-3.1-2.4c-.9.6-2 1-3.5 1-2.6 0-4.8-1.8-5.6-4.1H3.2v2.5C4.8 19.7 8.1 22 12 22Z" fill="#34A853" />
      <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.5H3.2C2.4 8.8 2 10.3 2 12s.4 3.2 1.2 4.5L6.4 14Z" fill="#FBBC05" />
      <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3 14.7 2 12 2 8.1 2 4.8 4.3 3.2 7.5L6.4 10c.8-2.3 3-4.1 5.6-4.1Z" fill="#EA4335" />
    </svg>
  );
}

function NavIcon({ view }: { view: AppView }) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    height: 20,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
    width: 20
  };

  if (view === "home") {
    return (
      <svg {...common}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10.5V20h13v-9.5" />
        <path d="M9.5 20v-5h5v5" />
      </svg>
    );
  }

  if (view === "book") {
    return (
      <svg {...common}>
        <path d="M7 3v3" />
        <path d="M17 3v3" />
        <path d="M4.5 8h15" />
        <rect height="16" rx="3" width="15" x="4.5" y="5" />
        <path d="M9 13h6" />
        <path d="M9 17h3" />
      </svg>
    );
  }

  if (view === "locations") {
    return (
      <svg {...common}>
        <path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (view === "passes") {
    return (
      <svg {...common}>
        <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
        <path d="M9 9h6" />
        <path d="M9 15h4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  );
}

type CustomerWorkspaceProps = {
  allBookings: Booking[];
  bookings: Booking[];
  cancelBooking: (bookingId: string) => void;
  currentCustomer: Customer;
  handleCheckout: () => void;
  profileName: string;
  profilePhone: string;
  saveProfile: (event: FormEvent<HTMLFormElement>) => void;
  selectedDate: string;
  selectedSessions: string[];
  selectedType: string;
  sessions: Session[];
  setProfileName: (value: string) => void;
  setProfilePhone: (value: string) => void;
  setSelectedDate: (value: string) => void;
  setSelectedSessions: (value: string[]) => void;
  setSelectedType: (value: string) => void;
  subscribe: (planId: string) => void;
};

function HomeWorkspace({
  bookings,
  currentCustomer,
  installPromptReady,
  isOnline,
  isStandalone,
  onInstallApp,
  pwaMessage,
  sessions,
  setView
}: {
  bookings: Booking[];
  currentCustomer: Customer;
  installPromptReady: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  onInstallApp: () => void;
  pwaMessage: string;
  sessions: Session[];
  setView: (view: AppView) => void;
}) {
  const nextBooking = bookings.find((booking) => booking.status === "confirmed" || booking.status === "checked-in");
  const nextSession = nextBooking ? sessions.find((session) => session.id === nextBooking.sessionId) : sessions[0];

  return (
    <div className="workspace-grid">
      <section className="surface welcome-card">
        <p className="eyebrow">Welcome back</p>
        <h3>{currentCustomer.name.split(" ")[0]}, reserve your place to unwind.</h3>
        <p>Choose a time, number of spots, and pay only when availability is confirmed.</p>
        <button onClick={() => setView("book")}>Book sauna spots</button>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Next visit</p>
            <h3>{nextSession ? getSessionType(nextSession.typeId).name : "No booking yet"}</h3>
          </div>
          <span className="pill">{currentCustomer.credits} credits</span>
        </div>
        {nextSession && (
          <div className="visit-card">
            <strong>{nextSession.date} at {nextSession.time}</strong>
            <span>{nextSession.capacity - activeBookingsFor(nextSession.id, bookings).length} spots still open</span>
          </div>
        )}
      </section>

      <section className="surface">
        <p className="eyebrow">Facilities</p>
        <div className="facility-strip">
          {["Sauna", "Cold plunge", "Steam", "Tea lounge"].map((item) => (
            <button key={item} onClick={() => setView("locations")}>{item}</button>
          ))}
        </div>
      </section>

      <section className="surface pwa-card">
        <div>
          <p className="eyebrow">App status</p>
          <h3>{isStandalone ? "Installed app" : installPromptReady ? "Install Clave" : "PWA ready"}</h3>
          <p>{pwaMessage}</p>
        </div>
        <div className="pwa-status-row">
          <span className={`status ${isOnline ? "paid" : "waitlist"}`}>{isOnline ? "Online" : "Offline"}</span>
          <span className="pill">Offline cache</span>
        </div>
        <button onClick={onInstallApp}>{isStandalone ? "Installed" : "Install app"}</button>
      </section>
    </div>
  );
}

function CustomerWorkspace(props: CustomerWorkspaceProps) {
  const {
    allBookings,
    bookings,
    cancelBooking,
    currentCustomer,
    handleCheckout,
    profileName,
    profilePhone,
    saveProfile,
    selectedDate,
    selectedSessions,
    selectedType,
    sessions,
    setProfileName,
    setProfilePhone,
    setSelectedDate,
    setSelectedSessions,
    setSelectedType,
    subscribe
  } = props;

  const basketTotal = selectedSessions.reduce((sum, sessionId) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return sum;
    const isFull = activeBookingsFor(session.id, allBookings).length >= session.capacity;
    if (isFull || currentCustomer.credits > 0) return sum;
    return sum + getSessionType(session.typeId).price;
  }, 0);

  return (
    <div className="workspace-grid customer-grid">
      <section className="surface mobile-frame">
        <div className="mobile-top">
          <div>
            <p className="eyebrow">Mobile app</p>
            <h3>Book sauna spots</h3>
          </div>
          <div className="logged-in-user" aria-label="Logged in user">
            <span>Logged in as</span>
            <strong>{currentCustomer.name}</strong>
          </div>
        </div>

        <div className="filter-row">
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            <option value="all">All types</option>
            {sessionTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        <div className="session-list">
          {sessions.map((session) => {
            const type = getSessionType(session.typeId);
            const activeCount = activeBookingsFor(session.id, allBookings).length;
            const full = activeCount >= session.capacity;
            const selected = selectedSessions.includes(session.id);

            return (
              <button
                className={`session-row ${selected ? "selected" : ""}`}
                key={session.id}
                onClick={() =>
                  setSelectedSessions(selected ? selectedSessions.filter((id) => id !== session.id) : [...selectedSessions, session.id])
                }
              >
                <span>
                  <strong>{session.time}</strong>
                  <small>{type.name} · {type.benefits.join(", ")}</small>
                </span>
                <span>
                  <strong>{full ? "Waitlist" : `${session.capacity - activeCount} spots`}</strong>
                  <small>{type.duration} min</small>
                </span>
              </button>
            );
          })}
        </div>

        <div className="checkout-bar">
          <div>
            <strong>{formatCurrency(basketTotal)}</strong>
            <p>{currentCustomer.credits} credits available</p>
          </div>
          <button onClick={handleCheckout}>Pay and confirm</button>
        </div>
      </section>
    </div>
  );
}

function LocationsWorkspace({ locations, setView }: { locations: Location[]; setView: (view: AppView) => void }) {
  return (
    <div className="workspace-grid">
      {locations.map((location) => (
        <section className="surface location-card" key={location.id}>
          <div className="location-photo" style={{ backgroundImage: `url(${location.image})` }} aria-hidden="true" />
          <div className="section-head">
            <div>
              <p className="eyebrow">{location.hours}</p>
              <h3>{location.name}</h3>
            </div>
          </div>
          <p>{location.address}</p>
          <div className="facility-strip">
            {location.facilities.map((facility) => (
              <span className="pill" key={facility}>{facility}</span>
            ))}
          </div>
          <button onClick={() => setView("book")}>Book at this bathhouse</button>
        </section>
      ))}
    </div>
  );
}

function PassesWorkspace({
  currentCustomer,
  subscribe
}: {
  currentCustomer: Customer;
  subscribe: (planId: string) => void;
}) {
  return (
    <div className="workspace-grid">
      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Passes</p>
            <h3>Memberships and vouchers</h3>
          </div>
          <span className="pill">{getPlan(currentCustomer.membershipId).name}</span>
        </div>
        <div className="plan-grid">
          {plans.map((plan) => (
            <article className="plan-card" key={plan.id}>
              <strong>{plan.name}</strong>
              <span>{formatCurrency(plan.price)} / month</span>
              <p>{plan.credits} bathhouse credits renewed automatically.</p>
              <button onClick={() => subscribe(plan.id)}>{currentCustomer.membershipId === plan.id ? "Current" : "Choose"}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="surface voucher-card">
        <p className="eyebrow">Gift vouchers</p>
        <h3>Send a bathhouse visit</h3>
        <p>Choose a single visit or set your own voucher value.</p>
        <div className="voucher-actions">
          <button>$58 visit</button>
          <label className="voucher-value">
            Custom value
            <span>
              <strong>$</strong>
              <input inputMode="decimal" min="1" placeholder="Enter amount" type="number" />
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}

function ProfileWorkspace({
  bookings,
  cancelBooking,
  currentCustomer,
  handleSignOut,
  notices,
  profileName,
  profilePhone,
  saveProfile,
  setProfileName,
  setProfilePhone,
  sessions
}: {
  bookings: Booking[];
  cancelBooking: (bookingId: string) => void;
  currentCustomer: Customer;
  handleSignOut: () => void;
  notices: Notice[];
  profileName: string;
  profilePhone: string;
  saveProfile: (event: FormEvent<HTMLFormElement>) => void;
  setProfileName: (value: string) => void;
  setProfilePhone: (value: string) => void;
  sessions: Session[];
}) {
  return (
    <div className="workspace-grid">
      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Profile</p>
            <h3>Account and payments</h3>
          </div>
          <span className="pill">Tokenized</span>
        </div>
        <form className="profile-form" onSubmit={saveProfile}>
          <label>
            Name
            <input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
          </label>
          <label>
            Phone
            <input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} />
          </label>
          <label>
            Stored payment
            <input readOnly value={currentCustomer.paymentMethod} />
          </label>
          <button>Save profile</button>
        </form>
      </section>

      <section className="surface account-actions">
        <p className="eyebrow">Security</p>
        <h3>Signed in as {currentCustomer.name}</h3>
        <p>{currentCustomer.email}</p>
        <button className="quiet" onClick={handleSignOut}>Sign out</button>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Bookings</p>
            <h3>Your visits</h3>
          </div>
        </div>
        <div className="table-list">
          {bookings.map((booking) => {
            const session = sessions.find((item) => item.id === booking.sessionId) ?? { date: "2026-05-24", time: "TBC", typeId: "thermal" };
            return (
              <div className="table-row" key={booking.id}>
                <span>{getSessionType(session.typeId).name}</span>
                <span>{session.date} {session.time}</span>
                <span className={`status ${booking.status}`}>{booking.status}</span>
                <button className="quiet" onClick={() => cancelBooking(booking.id)}>Cancel</button>
              </div>
            );
          })}
        </div>
      </section>

      <NotificationRail notices={notices} />
    </div>
  );
}

function StaffWorkspace({ bookings, checkIn, sessions }: { bookings: Booking[]; checkIn: (bookingId: string) => void; sessions: Session[] }) {
  const todaysSessions = sessions.filter((session) => session.date === "2026-05-24");

  return (
    <div className="workspace-grid staff-grid">
      {todaysSessions.map((session) => {
        const attendees = bookings.filter((booking) => booking.sessionId === session.id && booking.status !== "cancelled");
        return (
          <section className="surface schedule-block" key={session.id}>
            <div className="section-head">
              <div>
                <p className="eyebrow">{session.time}</p>
                <h3>{getSessionType(session.typeId).name}</h3>
              </div>
              <span className="pill">{attendees.filter((item) => item.status === "checked-in").length}/{session.capacity} checked in</span>
            </div>
            <div className="attendance-list">
              {attendees.map((booking) => (
                <div className="attendance-row" key={booking.id}>
                  <span>
                    <strong>{booking.customerName}</strong>
                    <small>{booking.status}</small>
                  </span>
                  <button disabled={booking.status === "checked-in" || booking.status === "waitlist"} onClick={() => checkIn(booking.id)}>
                    Check in
                  </button>
                </div>
              ))}
              {attendees.length === 0 && <p className="empty-state">No attendees yet.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

type AdminWorkspaceProps = {
  bookings: Booking[];
  cancelBooking: (bookingId: string) => void;
  createSession: (event: FormEvent<HTMLFormElement>) => void;
  customers: Customer[];
  newCapacity: number;
  newDate: string;
  newTime: string;
  newTypeId: string;
  occupancy: number;
  refund: (transactionId: string) => void;
  revenue: number;
  sessions: Session[];
  setNewCapacity: (value: number) => void;
  setNewDate: (value: string) => void;
  setNewTime: (value: string) => void;
  setNewTypeId: (value: string) => void;
  transactions: Transaction[];
};

function AdminWorkspace(props: AdminWorkspaceProps) {
  const {
    bookings,
    cancelBooking,
    createSession,
    customers,
    newCapacity,
    newDate,
    newTime,
    newTypeId,
    occupancy,
    refund,
    revenue,
    sessions,
    setNewCapacity,
    setNewDate,
    setNewTime,
    setNewTypeId,
    transactions
  } = props;

  return (
    <div className="workspace-grid admin-grid">
      <section className="metric-band">
        <article>
          <span>Revenue</span>
          <strong>{formatCurrency(revenue)}</strong>
        </article>
        <article>
          <span>Occupancy</span>
          <strong>{Math.round(occupancy * 100)}%</strong>
        </article>
        <article>
          <span>Bookings</span>
          <strong>{bookings.filter((booking) => booking.status !== "cancelled").length}</strong>
        </article>
        <article>
          <span>Members</span>
          <strong>{customers.filter((customer) => customer.membershipId !== "drop-in").length}</strong>
        </article>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Configuration</p>
            <h3>Session schedule</h3>
          </div>
        </div>
        <form className="session-form" onSubmit={createSession}>
          <select value={newTypeId} onChange={(event) => setNewTypeId(event.target.value)}>
            {sessionTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} />
          <input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} />
          <input type="number" min={1} max={40} value={newCapacity} onChange={(event) => setNewCapacity(Number(event.target.value))} />
          <button>Add session</button>
        </form>
        <div className="table-list">
          {sessions.map((session) => (
            <div className="table-row" key={session.id}>
              <span>{getSessionType(session.typeId).name}</span>
              <span>{session.date} {session.time}</span>
              <span>{activeBookingsFor(session.id, bookings).length}/{session.capacity}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Operations</p>
            <h3>All bookings</h3>
          </div>
        </div>
        <div className="table-list">
          {bookings.map((booking) => (
            <div className="table-row" key={booking.id}>
              <span>{booking.customerName}</span>
              <span>{booking.sessionId}</span>
              <span className={`status ${booking.status}`}>{booking.status}</span>
              <button className="quiet" onClick={() => cancelBooking(booking.id)}>Cancel</button>
            </div>
          ))}
        </div>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Payments</p>
            <h3>Transactions</h3>
          </div>
        </div>
        <div className="table-list">
          {transactions.map((transaction) => (
            <div className="table-row" key={transaction.id}>
              <span>{transaction.id}</span>
              <span>{formatCurrency(transaction.amount)}</span>
              <span className={`status ${transaction.status}`}>{transaction.status}</span>
              <button className="quiet" disabled={transaction.status === "refunded"} onClick={() => refund(transaction.id)}>Refund</button>
            </div>
          ))}
        </div>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Users</p>
            <h3>Customer profiles</h3>
          </div>
        </div>
        <div className="customer-list">
          {customers.map((customer) => (
            <article key={customer.id}>
              <strong>{customer.name}</strong>
              <span>{customer.email}</span>
              <span>{getPlan(customer.membershipId).name}, {customer.credits} credits</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function NotificationRail({ notices }: { notices: Notice[] }) {
  return (
    <section className="notification-rail">
      <div className="section-head">
        <div>
          <p className="eyebrow">Notifications</p>
          <h3>Delivery log</h3>
        </div>
      </div>
      <div className="notice-list">
        {notices.map((notice) => (
          <article key={notice.id}>
            <span className="channel">{notice.channel}</span>
            <strong>{notice.title}</strong>
            <p>{notice.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
