import { FormEvent, useEffect, useMemo, useState } from "react";

type AppView = "home" | "book" | "calendar" | "locations" | "passes" | "me" | "staff" | "admin";
type AuthMode = "login" | "signup" | "reset" | "reset-complete";
type AdminTab = "overview" | "schedule" | "bookings" | "users" | "payments";
type BookingStatus = "confirmed" | "waitlist" | "cancelled" | "checked-in";
type PaymentStatus = "paid" | "refunded";
type Channel = "push" | "email" | "sms";
type Role = "customer" | "staff" | "admin";
type VoucherMode = "send" | "credit";
type BusyAction = "booking" | "cancel" | "check-in" | "profile" | "session" | "payment" | "";

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
  locationId?: string;
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
  role: Role;
  stripeCustomerId?: string | null;
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
  customerId?: string;
  customerName?: string;
  description?: string;
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
  isAuthenticated: boolean;
  selectedCustomerId: string;
  view: AppView;
  version?: number;
};

type AuthResponse = {
  bookings?: Booking[];
  customer?: Customer;
  customers?: Customer[];
  message?: string;
  sessions?: Session[];
  state?: Partial<PersistedAppState> | null;
  transactions?: Transaction[];
  error?: string;
};

type ProfileResponse = AuthResponse & {
  transactions?: Transaction[];
};

type SessionsResponse = {
  session?: Session;
  sessions?: Session[];
};

type BookingsResponse = {
  booking?: Booking;
  bookings?: Booking[];
  customer?: Customer;
  customers?: Customer[];
  message?: string;
  transactions?: Transaction[];
};

type CustomersResponse = {
  customer?: Customer;
  customers?: Customer[];
};

type VoucherResponse = {
  creditsAdded?: number;
  customer?: Customer;
  transactions?: Transaction[];
  voucher?: {
    code: string;
  };
};

type HealthResponse = {
  checks?: Record<string, boolean>;
  missing?: string[];
  ok?: boolean;
  timestamp?: string;
};

type BootstrapResponse = {
  bookings?: Booking[];
  customers?: Customer[];
  sessions?: Session[];
  state?: Partial<PersistedAppState> | null;
  transactions?: Transaction[];
};

type ApiErrorBody = {
  error?: string;
  message?: string;
};

class ApiError extends Error {
  body: ApiErrorBody;
  status: number;

  constructor(message: string, status: number, body: ApiErrorBody = {}) {
    super(message);
    this.body = body;
    this.status = status;
  }
}

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

function localDateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function sessionStartsAt(session: Session) {
  return new Date(`${session.date}T${session.time}:00+08:00`);
}

function isFutureSession(session: Session) {
  return sessionStartsAt(session).getTime() > Date.now();
}

const initialSessions: Session[] = [];

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
    id: "pending",
    name: "Signed out",
    email: "",
    phone: "",
    membershipId: "drop-in",
    credits: 0,
    paymentMethod: "",
    role: "admin"
  }
];

const initialBookings: Booking[] = [];

const initialTransactions: Transaction[] = [];

const initialNotices: Notice[] = [];

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

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", weekday: "short" }).format(parsed);
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

function normalizeAppView(view?: AppView) {
  return view === "locations" ? "book" : view ?? "home";
}

function readPersistedState(): Partial<PersistedAppState> {
  try {
    const stored = window.localStorage.getItem("clave-app-state");
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Partial<PersistedAppState>;
    return parsed.version === 2 ? parsed : {};
  } catch {
    return {};
  }
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  const data = await readJsonResponse<T>(response);
  if (!response.ok) {
    const body = data as ApiErrorBody;
    throw new ApiError(body.message ?? "Request failed", response.status, body);
  }
  return data;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await readJsonResponse<T>(response);
  if (!response.ok) {
    const body = data as ApiErrorBody;
    throw new ApiError(body.message ?? "Request failed", response.status, body);
  }
  return data;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    const fallback = body.trim().startsWith("<!doctype") ? "The local preview server is not serving API routes." : "Expected a JSON response.";
    throw new Error(fallback);
  }
  return (await response.json()) as T;
}

function isStaticPreviewError(error: unknown) {
  return error instanceof ApiError && error.body.error === "api_unavailable";
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function defaultViewForRole(role: Role): AppView {
  if (role === "admin") return "admin";
  if (role === "staff") return "staff";
  return "home";
}

export function App() {
  const persistedState = useMemo(() => readPersistedState(), []);
  const [view, setView] = useState<AppView>(normalizeAppView(persistedState.view));
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("pending");
  const [selectedDate, setSelectedDate] = useState(() => localDateAfter(1));
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [bookingFeedback, setBookingFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [passFeedback, setPassFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authResetToken, setAuthResetToken] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pwaMessage, setPwaMessage] = useState("Offline-ready after first load.");
  const [syncStatus, setSyncStatus] = useState<"local" | "syncing" | "synced" | "error">("local");
  const [operationalMessage, setOperationalMessage] = useState("");
  const [isLoadingOperations, setIsLoadingOperations] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>("");
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [newCapacity, setNewCapacity] = useState(8);
  const [newTypeId, setNewTypeId] = useState("thermal");
  const [newLocationId, setNewLocationId] = useState("scarborough");
  const [newDate, setNewDate] = useState(() => localDateAfter(4));
  const [newEndDate, setNewEndDate] = useState(() => localDateAfter(10));
  const [newTime, setNewTime] = useState("16:00");
  const [newPractitioner, setNewPractitioner] = useState("Clave Team");
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const [emptySessionRetry, setEmptySessionRetry] = useState(false);

  const currentCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0];
  const canUseStaffTools = currentCustomer.role === "staff" || currentCustomer.role === "admin";
  const canUseAdminTools = currentCustomer.role === "admin";
  const navItems: AppView[] = ["home", "book", "calendar", "passes", "me"];
  if (canUseStaffTools) navItems.push("staff");
  if (canUseAdminTools) navItems.push("admin");

  const customerBookings = bookings.filter((booking) => booking.customerId === currentCustomer.id);
  const customerActiveBookings = customerBookings.filter((booking) => booking.status !== "cancelled");
  const occupancy =
    sessions.reduce((sum, session) => sum + activeBookingsFor(session.id, bookings).length / session.capacity, 0) / Math.max(sessions.length, 1);

  useEffect(() => {
    const nextState: PersistedAppState = {
      isAuthenticated,
      selectedCustomerId,
      view,
      version: 2
    };
    window.localStorage.setItem("clave-app-state", JSON.stringify(nextState));
  }, [isAuthenticated, selectedCustomerId, view]);

  useEffect(() => {
    const authParams = new URLSearchParams(window.location.search);
    const authResult = authParams.get("auth");
    const handoffToken = authParams.get("handoff");

    if (authResult === "google_success" && handoffToken) {
      postJson<AuthResponse>("/api/auth/handoff", { token: handoffToken })
        .then((result) => {
          if (!result.customer) throw new Error("Google sign in finished, but the account could not be loaded.");
          applyRemoteSession(result.customer);
          applyLiveData(result);
          setIsAuthenticated(true);
          setSyncStatus("synced");
          loadOperationalData(result.customer);
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch((error) => {
          setAuthMessage(error instanceof Error ? error.message : "Google sign in finished, but the session could not be restored.");
          setSyncStatus("local");
        });
      return;
    }

    getJson<AuthResponse>("/api/auth")
      .then((result) => {
        if (!result.customer) {
          if (authResult === "google_success") {
            setAuthMessage("Google sign in finished, but the session cookie was not found. Check that the callback URL and app URL use the same domain.");
          }
          return;
        }
        applyRemoteSession(result.customer);
        applyLiveData(result);
        setIsAuthenticated(true);
        setSyncStatus("synced");
        loadOperationalData(result.customer);
      })
      .catch((error) => {
        if (authResult === "google_success") {
          setAuthMessage(error instanceof Error ? error.message : "Google sign in finished, but the session could not be restored.");
        }
        setSyncStatus("local");
      });
  }, []);

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

  useEffect(() => {
    if (!isAuthenticated || sessions.length > 0 || isLoadingOperations || emptySessionRetry) return;
    setEmptySessionRetry(true);
    loadOperationalData(currentCustomer);
  }, [currentCustomer, emptySessionRetry, isAuthenticated, isLoadingOperations, sessions.length]);

  useEffect(() => {
    if (!canUseAdminTools || healthStatus) return;
    getJson<HealthResponse>("/api/health")
      .then(setHealthStatus)
      .catch(() => undefined);
  }, [canUseAdminTools, healthStatus]);

  function pushNotice(channel: Channel, title: string, body: string) {
    setNotices((current) => [{ id: `n${Date.now()}`, channel, title, body }, ...current].slice(0, 8));
  }

  function applyRemoteSession(customer: Customer) {
    setEmptySessionRetry(false);
    setSelectedCustomerId(customer.id);
    setProfileName(customer.name);
    setProfilePhone(customer.phone);
    setView(defaultViewForRole(customer.role));
    setCustomers((current) => {
      const withoutCustomer = current.filter((item) => item.id !== customer.id);
      return [customer, ...withoutCustomer];
    });

    setNotices([]);
  }

  function mergeCustomer(customer?: Customer) {
    if (!customer) return;
    setCustomers((current) => {
      const exists = current.some((item) => item.id === customer.id);
      return exists ? current.map((item) => (item.id === customer.id ? customer : item)) : [customer, ...current];
    });
    if (customer.id === selectedCustomerId) {
      setProfileName(customer.name);
      setProfilePhone(customer.phone);
    }
  }

  function applyOperationalResponse(result: { bookings?: Booking[]; customer?: Customer; customers?: Customer[]; transactions?: Transaction[] }) {
    if (result.bookings) setBookings(result.bookings);
    if (result.transactions) setTransactions(result.transactions);
    if (result.customers) setCustomers(result.customers);
    else mergeCustomer(result.customer);
  }

  function applyLiveData(result: { bookings?: Booking[]; customers?: Customer[]; sessions?: Session[]; transactions?: Transaction[] }) {
    if (result.sessions) {
      setSessions(result.sessions);
      const hasSelectedDate = result.sessions.some((session) => session.date === selectedDate);
      if (!hasSelectedDate && result.sessions[0]) setSelectedDate(result.sessions[0].date);
    }
    if (result.bookings) setBookings(result.bookings);
    if (result.customers) setCustomers(result.customers);
    if (result.transactions) setTransactions(result.transactions);
  }

  async function loadOperationalData(customer = currentCustomer) {
    setIsLoadingOperations(true);
    setOperationalMessage("");
    try {
      const result = await getJson<BootstrapResponse>("/api/state");
      applyLiveData({
        ...result,
        customers: customer.role === "admin" ? result.customers : undefined
      });
      setSyncStatus("synced");
    } catch (error) {
      if (isStaticPreviewError(error)) {
        setSyncStatus("local");
        setOperationalMessage("Booking data could not be loaded. Check the app connection and try again.");
      } else {
        setSyncStatus("error");
        setOperationalMessage(messageFromError(error, "We could not load the latest availability. Please try again."));
      }
    } finally {
      setIsLoadingOperations(false);
    }
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

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authMode === "reset") {
      try {
        const result = await postJson<AuthResponse>("/api/auth", { email: authEmail, mode: "reset" });
        setAuthMessage(result.message ?? `Password reset link sent to ${authEmail}.`);
        setAuthPassword("");
        setAuthMode("reset-complete");
      } catch {
        setAuthMessage("Password reset could not be started. Check the app connection and try again.");
        return;
      }
      pushNotice("email", "Password reset", `A secure reset link was sent to ${authEmail}.`);
      return;
    }

    if (authMode === "reset-complete") {
      if (!authEmail || !authResetToken || authPassword.length < 8) {
        setAuthMessage("Enter your email, reset token, and a new password of at least 8 characters.");
        return;
      }

      try {
        const result = await postJson<AuthResponse>("/api/auth", {
          email: authEmail,
          mode: "reset-complete",
          password: authPassword,
          token: authResetToken
        });
        if (!result.customer) throw new Error(result.message ?? "Password reset failed.");
        applyRemoteSession(result.customer);
        applyLiveData(result);
        setIsAuthenticated(true);
        setAuthMessage("");
        setAuthPassword("");
        setAuthResetToken("");
        pushNotice("push", "Password changed", "Your password was updated and you are signed in.");
        loadOperationalData(result.customer);
      } catch (error) {
        setSyncStatus("error");
        setAuthMessage(error instanceof Error ? error.message : "Password reset failed.");
      }
      return;
    }

    if (!authEmail || !authPassword) {
      setAuthMessage("Enter an email and password to continue.");
      return;
    }

    if (authMode === "login") {
      try {
        const result = await postJson<AuthResponse>("/api/auth", { email: authEmail, mode: "login", password: authPassword });
        if (!result.customer) throw new Error(result.message ?? "Sign in failed");
        applyRemoteSession(result.customer);
        applyLiveData(result);
        setIsAuthenticated(true);
        setAuthMessage("");
        pushNotice("push", "Welcome back", `${result.customer.name} signed in.`);
        loadOperationalData(result.customer);
      } catch (error) {
        setSyncStatus("error");
        setAuthMessage(error instanceof Error ? error.message : "Sign in failed.");
      }
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
      paymentMethod: "",
      role: "customer"
    };

    try {
      const result = await postJson<AuthResponse>("/api/auth", { customer: newCustomer, mode: "signup", password: authPassword });
      applyRemoteSession(result.customer ?? newCustomer);
      applyLiveData(result);
      setSyncStatus("synced");
      setIsAuthenticated(true);
      setAuthMessage("");
      pushNotice("email", "Account created", `Welcome to Clave Bathhouse, ${newCustomer.name}.`);
      loadOperationalData(result.customer ?? newCustomer);
    } catch (error) {
      setSyncStatus("error");
      setAuthMessage(error instanceof Error ? error.message : "Account creation failed.");
    }
  }

  async function handleSocialAuth(provider: "Google") {
    if (provider === "Google") {
      window.location.assign("/api/auth/google");
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => undefined);
    window.localStorage.removeItem("clave-app-state");
    setIsAuthenticated(false);
    setAuthMode("login");
    setAuthPassword("");
    setNotices([]);
    setTransactions([]);
    setSessions([]);
    setBookings([]);
    setEmptySessionRetry(false);
    setView("home");
  }

  async function handleCheckout() {
    if (selectedSessions.length === 0) {
      setBookingFeedback({ tone: "error", message: "Choose at least one session before confirming." });
      pushNotice("push", "Choose a time", "Select at least one bathhouse spot before checkout.");
      return;
    }

    const visibleSessionIds = new Set(
      sessions
        .filter((session) => {
          const matchesDate = session.date === selectedDate;
          const matchesLocation = !selectedLocationId || (session.locationId ?? "scarborough") === selectedLocationId;
          const matchesType = selectedType === "all" || session.typeId === selectedType;
          return matchesDate && matchesLocation && matchesType && isFutureSession(session);
        })
        .map((session) => session.id)
    );
    const validSelectedSessions = selectedSessions.filter((sessionId) => visibleSessionIds.has(sessionId));
    if (validSelectedSessions.length === 0) {
      setSelectedSessions([]);
      setBookingFeedback({ tone: "error", message: "Choose an available session from this location and date." });
      return;
    }

    const alreadyBooked = validSelectedSessions.some((sessionId) =>
      bookings.some(
        (booking) =>
          booking.customerId === currentCustomer.id &&
          booking.sessionId === sessionId &&
          ["confirmed", "waitlist", "checked-in"].includes(booking.status)
      )
    );
    if (alreadyBooked) {
      setSelectedSessions([]);
      setBookingFeedback({ tone: "error", message: "You already have a booking for that session." });
      return;
    }

    const createdBookings: Booking[] = [];

    for (const sessionId of validSelectedSessions) {
      const session = sessions.find((item) => item.id === sessionId);
      if (!session) continue;

      const full = activeBookingsFor(sessionId, bookings.concat(createdBookings)).length >= session.capacity;
      const bookingId = `b${Date.now()}-${sessionId}`;
      const status: BookingStatus = full ? "waitlist" : "confirmed";

      createdBookings.push({
        id: bookingId,
        sessionId,
        customerId: currentCustomer.id,
        customerName: currentCustomer.name,
        status,
        paid: 0,
        createdAt: new Date().toISOString()
      });
    }

    setBusyAction("booking");
    setOperationalMessage("");
    try {
      let latestBookings: Booking[] | undefined;
      let creditsUsed = 0;
      let paidTotal = 0;
      let waitlisted = 0;
      for (const booking of createdBookings) {
        const session = sessions.find((item) => item.id === booking.sessionId);
        const amountCents = session ? Math.round(getSessionType(session.typeId).price * 100) : 0;
        const result = await postJson<BookingsResponse>("/api/bookings", {
          amountCents,
          sessionId: booking.sessionId
        });
        applyOperationalResponse(result);
        if (result.booking?.status === "waitlist") waitlisted += 1;
        if (result.booking?.paymentId === "membership-credit") creditsUsed += 1;
        if ((result.booking?.paid ?? 0) > 0) paidTotal += result.booking?.paid ?? 0;
        latestBookings = result.bookings;
      }
      if (latestBookings) setBookings(latestBookings);
      setSelectedSessions([]);
      const paymentNote = paidTotal > 0 ? ` Payment approved for ${formatCurrency(paidTotal)}.` : creditsUsed > 0 ? ` ${creditsUsed} credit used.` : "";
      const waitlistNote = waitlisted > 0 ? ` ${waitlisted} visit${waitlisted > 1 ? "s are" : " is"} on the waitlist.` : "";
      setBookingFeedback({ tone: "success", message: `Booking saved.${paymentNote}${waitlistNote}` });
      pushNotice("email", "Booking confirmed", `Your Clave Bathhouse visit is booked.${paymentNote}`);
    } catch (error) {
      const message = messageFromError(error, "We could not complete that booking. Please try another time.");
      setOperationalMessage(message);
      setBookingFeedback({ tone: "error", message });
      pushNotice("sms", "Booking not completed", message);
      void loadOperationalData();
    } finally {
      setBusyAction("");
    }
  }

  function updateBookingDate(value: string) {
    setSelectedDate(value);
    setSelectedSessions([]);
    setBookingFeedback(null);
  }

  function updateBookingType(value: string) {
    setSelectedType(value);
    setSelectedSessions([]);
    setBookingFeedback(null);
  }

  function selectBookingLocation(locationId: string | null) {
    setSelectedLocationId(locationId);
    setSelectedSessions([]);
    setBookingFeedback(null);

    if (!locationId) return;

    const datesForLocation = sessions
      .filter((session) => {
        const matchesLocation = (session.locationId ?? "scarborough") === locationId;
        const matchesType = selectedType === "all" || session.typeId === selectedType;
        return matchesLocation && matchesType;
      })
      .map((session) => session.date)
      .sort();
    const nextDate = datesForLocation.find((date) => date >= selectedDate) ?? datesForLocation[0];
    if (nextDate && nextDate !== selectedDate) setSelectedDate(nextDate);
  }

  async function cancelBooking(bookingId: string) {
    const target = bookings.find((booking) => booking.id === bookingId);
    if (!target) return;

    const session = sessions.find((item) => item.id === target.sessionId);
    if (!session) return;

    if (target.status !== "confirmed" && target.status !== "waitlist") {
      pushNotice("sms", "Cancellation unavailable", "Only confirmed or waitlisted bookings can be cancelled.");
      return;
    }

    const sessionStart = sessionStartsAt(session);
    const policyDeadline = new Date();
    if (sessionStart.getTime() - policyDeadline.getTime() < 6 * 60 * 60 * 1000) {
      pushNotice("sms", "Cancellation blocked", "This booking is inside the six hour cancellation window.");
      return;
    }

    const sessionLabel = `${getSessionType(session.typeId).name} on ${session.date} at ${session.time}`;
    const confirmed = window.confirm(`Cancel this booking?\n\n${sessionLabel}\n\nThis cannot be undone.`);
    if (!confirmed) return;

    setBusyAction("cancel");
    setOperationalMessage("");
    try {
      const result = await postJson<BookingsResponse>("/api/bookings", { action: "cancel", bookingId });
      applyOperationalResponse(result);
    } catch (error) {
      setOperationalMessage(messageFromError(error, "We could not cancel that booking. Please try again."));
      pushNotice("sms", "Cancellation not completed", messageFromError(error, "We could not cancel that booking. Please try again."));
      return;
    } finally {
      setBusyAction("");
    }
    const refundNote = target.paymentId === "membership-credit" ? " One credit was returned." : target.paid > 0 ? " Payment was refunded." : "";
    pushNotice("email", "Booking cancelled", `${target.customerName}'s booking was cancelled.${refundNote}`);
  }

  async function checkIn(bookingId: string) {
    setBusyAction("check-in");
    setOperationalMessage("");
    try {
      const result = await postJson<BookingsResponse>("/api/bookings", { action: "check-in", bookingId });
      applyOperationalResponse(result);
    } catch (error) {
      setOperationalMessage(messageFromError(error, "Check-in could not be completed."));
      pushNotice("sms", "Check-in not completed", messageFromError(error, "Check-in could not be completed."));
      return;
    } finally {
      setBusyAction("");
    }
    pushNotice("push", "Check-in complete", "Attendance has been updated for the bathhouse.");
  }

  async function subscribe(membershipId: string) {
    const plan = getPlan(membershipId);
    if (currentCustomer.membershipId === plan.id) {
      pushNotice("push", "Plan already active", `${plan.name} is already on your account.`);
      return;
    }

    setBusyAction("payment");
    setOperationalMessage("");
    setPassFeedback(null);
    try {
      const result = await postJson<ProfileResponse>("/api/profile", { action: "membership", membershipId: plan.id });
      if (result.customer) mergeCustomer(result.customer);
      if (result.transactions) setTransactions(result.transactions);
      setPassFeedback({ tone: "success", message: `${plan.name} is active. Payment approved.` });
      pushNotice("email", "Membership updated", `${plan.name} is active. Payment approved.`);
    } catch (error) {
      const message = messageFromError(error, "Membership could not be updated. Please try again.");
      setOperationalMessage(message);
      setPassFeedback({ tone: "error", message });
      pushNotice("sms", "Membership not updated", message);
    } finally {
      setBusyAction("");
    }
  }

  async function buyVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetForm = event.currentTarget;
    const form = new FormData(targetForm);
    const amount = Number(form.get("amount"));
    const mode = String(form.get("mode"));
    const recipientEmail = String(form.get("recipientEmail") ?? "").trim();

    setBusyAction("payment");
    setOperationalMessage("");
    setPassFeedback(null);
    try {
      const result = await postJson<VoucherResponse>("/api/vouchers", {
        amount,
        mode,
        recipientEmail
      });
      if (result.customer) {
        mergeCustomer(result.customer);
      }
      if (result.transactions) setTransactions(result.transactions);
      if (mode === "credit") {
        const message = `${result.creditsAdded ?? 1} visit credit added to your account. Payment approved.`;
        setPassFeedback({ tone: "success", message });
        pushNotice("push", "Credit added", message);
      } else {
        const message = `Gift voucher ${result.voucher?.code ?? ""} was sent to ${recipientEmail}. Payment approved.`;
        setPassFeedback({ tone: "success", message });
        pushNotice("email", "Voucher sent", message);
      }
      targetForm.reset();
    } catch (error) {
      const message = messageFromError(error, "Voucher could not be created.");
      setPassFeedback({ tone: "error", message });
      pushNotice("sms", "Voucher not created", message);
    } finally {
      setBusyAction("");
    }
  }

  async function redeemVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetForm = event.currentTarget;
    const form = new FormData(targetForm);
    const code = String(form.get("code") ?? "").trim();

    setBusyAction("payment");
    setOperationalMessage("");
    setPassFeedback(null);
    try {
      const result = await postJson<VoucherResponse>("/api/vouchers", {
        action: "redeem",
        code
      });
      if (result.customer) mergeCustomer(result.customer);
      const message = `${result.creditsAdded ?? 1} visit credit added to your account.`;
      setPassFeedback({ tone: "success", message });
      pushNotice("push", "Voucher redeemed", message);
      targetForm.reset();
    } catch (error) {
      const message = messageFromError(error, "Voucher code could not be redeemed.");
      setPassFeedback({ tone: "error", message });
      pushNotice("sms", "Voucher not redeemed", message);
    } finally {
      setBusyAction("");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("profile");
    setOperationalMessage("");
    try {
      const result = await postJson<ProfileResponse>("/api/profile", {
        name: profileName,
        phone: profilePhone
      });
      if (result.customer) {
        mergeCustomer(result.customer);
      }
      setSyncStatus("synced");
      pushNotice("push", "Profile saved", "Personal details were updated.");
    } catch (error) {
      setSyncStatus("error");
      setOperationalMessage(messageFromError(error, "Profile could not be saved. Please try again."));
      pushNotice("sms", "Profile not saved", messageFromError(error, "Profile could not be saved. Please try again."));
      return;
    } finally {
      setBusyAction("");
    }
  }

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session: Session = {
      id: `s${Date.now()}`,
      typeId: newTypeId,
      locationId: newLocationId,
      date: newDate,
      time: newTime,
      capacity: newCapacity,
      practitioner: newPractitioner.trim() || "Clave Team"
    };
    setBusyAction("session");
    setOperationalMessage("");
    try {
      const result = await postJson<SessionsResponse>("/api/sessions", { session });
      if (result.sessions) setSessions(result.sessions);
    } catch (error) {
      setOperationalMessage(messageFromError(error, "Session could not be created in Neon."));
      pushNotice("sms", "Schedule not saved", messageFromError(error, "Session could not be created in Neon."));
      return;
    } finally {
      setBusyAction("");
    }
    pushNotice("email", "Schedule updated", `${getSessionType(newTypeId).name} was added to the live timetable.`);
  }

  async function createSessionRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session: Session = {
      id: `s${Date.now()}`,
      typeId: newTypeId,
      locationId: newLocationId,
      date: newDate,
      time: newTime,
      capacity: newCapacity,
      practitioner: newPractitioner.trim() || "Clave Team"
    };
    setBusyAction("session");
    setOperationalMessage("");
    try {
      const result = await postJson<SessionsResponse>("/api/sessions", {
        action: "bulk-create",
        endDate: newEndDate,
        session,
        startDate: newDate
      });
      if (result.sessions) setSessions(result.sessions);
    } catch (error) {
      const message = messageFromError(error, "Schedule range could not be created in Neon.");
      setOperationalMessage(message);
      pushNotice("sms", "Schedule not saved", message);
      return;
    } finally {
      setBusyAction("");
    }
    pushNotice("email", "Schedule updated", `${getSessionType(newTypeId).name} was added from ${newDate} to ${newEndDate}.`);
  }

  async function updateSession(event: FormEvent<HTMLFormElement>, sessionId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const session: Session = {
      id: sessionId,
      capacity: Number(form.get("capacity")),
      date: String(form.get("date")),
      locationId: String(form.get("locationId") || "scarborough"),
      practitioner: String(form.get("practitioner") || "Clave Team"),
      time: String(form.get("time")),
      typeId: String(form.get("typeId"))
    };
    setBusyAction("session");
    setOperationalMessage("");
    try {
      const result = await postJson<SessionsResponse>("/api/sessions", { action: "update", session, sessionId });
      if (result.sessions) setSessions(result.sessions);
      else if (result.session) setSessions((current) => current.map((item) => (item.id === sessionId ? result.session! : item)));
      pushNotice("push", "Session saved", "The live timetable was updated.");
    } catch (error) {
      setOperationalMessage(messageFromError(error, "Session could not be updated in Neon."));
      pushNotice("sms", "Session not saved", messageFromError(error, "Session could not be updated in Neon."));
      return;
    } finally {
      setBusyAction("");
    }
  }

  async function deleteSession(sessionId: string) {
    setBusyAction("session");
    setOperationalMessage("");
    try {
      const result = await postJson<SessionsResponse>("/api/sessions", { action: "delete", sessionId });
      if (result.sessions) setSessions(result.sessions);
      pushNotice("push", "Session removed", "The timetable was updated.");
    } catch (error) {
      setOperationalMessage(messageFromError(error, "Session could not be removed in Neon."));
      pushNotice("sms", "Session not removed", messageFromError(error, "Session could not be removed in Neon."));
      return;
    } finally {
      setBusyAction("");
    }
  }

  async function updateCustomerRole(customerId: string, role: Role) {
    setBusyAction("profile");
    setOperationalMessage("");
    try {
      const result = await postJson<CustomersResponse>("/api/customers", { customerId, role });
      if (result.customers) setCustomers(result.customers);
      else if (result.customer) setCustomers((current) => current.map((customer) => (customer.id === customerId ? result.customer! : customer)));
      pushNotice("push", "Role updated", "Customer access was updated in Neon.");
    } catch (error) {
      setOperationalMessage(messageFromError(error, "Customer role could not be updated in Neon."));
      pushNotice("sms", "Role not saved", messageFromError(error, "Customer role could not be updated in Neon."));
      return;
    } finally {
      setBusyAction("");
    }
  }

  async function refund(transactionId: string) {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction || transaction.status === "refunded") return;

    const confirmed = window.confirm(`Refund ${formatCurrency(transaction.amount)}?\n\nThis will mark the demo payment as refunded.`);
    if (!confirmed) return;

    setBusyAction("payment");
    setOperationalMessage("");
    try {
      const result = await postJson<{ transaction?: Transaction; transactions?: Transaction[] }>("/api/state", {
        action: "refund-transaction",
        transactionId
      });
      if (result.transactions) setTransactions(result.transactions);
      pushNotice("email", "Refund processed", `${transaction.description ?? "Payment"} was refunded in demo mode.`);
    } catch (error) {
      setOperationalMessage(messageFromError(error, "Refund could not be saved in Neon."));
      pushNotice("sms", "Refund not saved", messageFromError(error, "Refund could not be saved in Neon."));
    } finally {
      setBusyAction("");
    }
  }

  async function refreshHealth() {
    setBusyAction("profile");
    try {
      setHealthStatus(await getJson<HealthResponse>("/api/health"));
    } catch (error) {
      setOperationalMessage(messageFromError(error, "Health check could not be loaded."));
    } finally {
      setBusyAction("");
    }
  }

  function goToView(nextView: AppView) {
    if (nextView === "book") {
      setSelectedLocationId(null);
      setSelectedSessions([]);
      setBookingFeedback(null);
    }
    setView(nextView);
  }

  return (
    <main className="clave-app">
      <section className="mobile-showcase">
        <div className="site-note">
          <p className="eyebrow">Clave Bathhouse</p>
          <h1>Relax, Refresh, Rejuvenate</h1>
          <p>
            Book bathhouse access, manage passes, and keep staff check-ins moving
            from one calm mobile workspace.
          </p>
        </div>

        <div className="phone-shell" aria-label="Clave Bathhouse mobile app">
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
              authResetToken={authResetToken}
              handleAuth={handleAuth}
              handleSocialAuth={handleSocialAuth}
              setAuthEmail={setAuthEmail}
              setAuthMessage={setAuthMessage}
              setAuthMode={setAuthMode}
              setAuthName={setAuthName}
              setAuthPassword={setAuthPassword}
              setAuthPhone={setAuthPhone}
              setAuthResetToken={setAuthResetToken}
            />
          ) : (
            <>
              <section className="app-scroll">
                {(isLoadingOperations || busyAction || operationalMessage) && (
                  <div className={`operation-banner ${syncStatus === "error" ? "error" : ""}`}>
                    {isLoadingOperations
                      ? "Checking availability..."
                      : busyAction
                        ? "Saving..."
                        : operationalMessage}
                  </div>
                )}

                {view === "home" && (
              <HomeWorkspace
                allBookings={bookings}
                bookings={customerActiveBookings}
                currentCustomer={currentCustomer}
                isLoading={isLoadingOperations && sessions.length === 0}
                locations={locations}
                setView={goToView}
                sessions={sessions}
              />
                )}

                {view === "book" && (
              <CustomerWorkspace
                allSessions={sessions}
                bookingFeedback={bookingFeedback}
                busyAction={busyAction}
                currentCustomer={currentCustomer}
                handleCheckout={handleCheckout}
                isLoading={isLoadingOperations && sessions.length === 0}
                locations={locations}
                selectedDate={selectedDate}
                selectedLocationId={selectedLocationId}
                selectedSessions={selectedSessions}
                selectedType={selectedType}
                setSelectedLocationId={selectBookingLocation}
                setSelectedDate={updateBookingDate}
                setSelectedSessions={setSelectedSessions}
                setSelectedType={updateBookingType}
                allBookings={bookings}
              />
                )}

                {view === "calendar" && (
              <CalendarWorkspace bookings={customerActiveBookings} sessions={sessions} />
                )}

                {view === "passes" && (
              <PassesWorkspace
                busyAction={busyAction}
                buyVoucher={buyVoucher}
                currentCustomer={currentCustomer}
                passFeedback={passFeedback}
                redeemVoucher={redeemVoucher}
                subscribe={subscribe}
              />
                )}

                {view === "me" && (
              <ProfileWorkspace
                bookings={customerActiveBookings}
                busyAction={busyAction}
                cancelBooking={cancelBooking}
                currentCustomer={currentCustomer}
                handleSignOut={handleSignOut}
                installPromptReady={Boolean(installPrompt)}
                isOnline={isOnline}
                isStandalone={isStandalone}
                notices={canUseStaffTools ? notices : []}
                onInstallApp={handleInstallApp}
                pwaMessage={pwaMessage}
                profileName={profileName}
                profilePhone={profilePhone}
                saveProfile={saveProfile}
                setProfileName={setProfileName}
                setProfilePhone={setProfilePhone}
                sessions={sessions}
                syncStatus={syncStatus}
              />
                )}

                {view === "staff" && canUseStaffTools && <StaffWorkspace bookings={bookings} checkIn={checkIn} sessions={sessions} />}

                {view === "admin" && canUseAdminTools && (
              <AdminWorkspace
                bookings={bookings}
                busyAction={busyAction}
                cancelBooking={cancelBooking}
                createSession={createSessionRange}
                adminTab={adminTab}
                currentCustomerId={currentCustomer.id}
                customers={customers}
                deleteSession={deleteSession}
                healthStatus={healthStatus}
                newCapacity={newCapacity}
                newDate={newDate}
                newEndDate={newEndDate}
                newLocationId={newLocationId}
                newPractitioner={newPractitioner}
                newTime={newTime}
                newTypeId={newTypeId}
                occupancy={occupancy}
                refund={refund}
                refreshHealth={refreshHealth}
                sessions={sessions}
                setNewCapacity={setNewCapacity}
                setNewDate={setNewDate}
                setNewEndDate={setNewEndDate}
                setNewLocationId={setNewLocationId}
                setNewPractitioner={setNewPractitioner}
                setNewTime={setNewTime}
                setNewTypeId={setNewTypeId}
                setAdminTab={setAdminTab}
                transactions={transactions}
                updateCustomerRole={updateCustomerRole}
                updateSession={updateSession}
              />
                )}
              </section>
              <nav className="bottom-nav" aria-label="Primary mobile navigation">
                {navItems.map((item) => (
                  <button className={view === item ? "active" : ""} key={item} onClick={() => goToView(item)}>
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
  authResetToken,
  handleAuth,
  handleSocialAuth,
  setAuthEmail,
  setAuthMessage,
  setAuthMode,
  setAuthName,
  setAuthPassword,
  setAuthPhone,
  setAuthResetToken
}: {
  authEmail: string;
  authMessage: string;
  authMode: AuthMode;
  authName: string;
  authPassword: string;
  authPhone: string;
  authResetToken: string;
  handleAuth: (event: FormEvent<HTMLFormElement>) => void;
  handleSocialAuth: (provider: "Google") => void;
  setAuthEmail: (value: string) => void;
  setAuthMessage: (value: string) => void;
  setAuthMode: (mode: AuthMode) => void;
  setAuthName: (value: string) => void;
  setAuthPassword: (value: string) => void;
  setAuthPhone: (value: string) => void;
  setAuthResetToken: (value: string) => void;
}) {
  const title =
    authMode === "signup" ? "Create your account" : authMode === "reset" || authMode === "reset-complete" ? "Reset password" : "Welcome back";
  const action = authMode === "signup" ? "Create account" : authMode === "reset" ? "Send reset token" : authMode === "reset-complete" ? "Update password" : "Sign in";
  const changeAuthMode = (mode: AuthMode) => {
    setAuthMessage("");
    setAuthMode(mode);
  };

  return (
    <section className="auth-screen">
      <div className="auth-card">
        <p className="eyebrow">Member access</p>
        <h3>{title}</h3>
        <p>
          {authMode === "signup"
            ? "Save your details, passes, vouchers, and bathhouse bookings."
            : authMode === "reset"
              ? "Enter your account email and we will send a secure reset link."
              : authMode === "reset-complete"
                ? "Enter the reset token from your email and choose a new password."
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

          {authMode === "reset-complete" && (
            <label>
              Reset token
              <input autoComplete="one-time-code" value={authResetToken} onChange={(event) => setAuthResetToken(event.target.value)} />
            </label>
          )}

          {authMode !== "reset" && (
            <label>
              {authMode === "reset-complete" ? "New password" : "Password"}
              <input
                autoComplete={authMode === "signup" || authMode === "reset-complete" ? "new-password" : "current-password"}
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </label>
          )}

          {authMessage && <p className="auth-message">{authMessage}</p>}
          <button>{action}</button>
        </form>

        <div className="auth-links">
          {authMode !== "login" && <button onClick={() => changeAuthMode("login")}>Back to login</button>}
          {authMode !== "signup" && <button onClick={() => changeAuthMode("signup")}>Create account</button>}
          {authMode !== "reset" && authMode !== "reset-complete" && <button onClick={() => changeAuthMode("reset")}>Forgot password</button>}
          {authMode === "reset-complete" && <button onClick={() => changeAuthMode("reset")}>Send again</button>}
          <button className="google-auth-link" onClick={() => handleSocialAuth("Google")} type="button">
            <GoogleIcon />
            <span>Google</span>
          </button>
        </div>
      </div>
    </section>
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
        <path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (view === "calendar") {
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
  allSessions: Session[];
  bookingFeedback: { tone: "success" | "error"; message: string } | null;
  busyAction: BusyAction;
  currentCustomer: Customer;
  handleCheckout: () => void;
  isLoading: boolean;
  locations: Location[];
  selectedDate: string;
  selectedLocationId: string | null;
  selectedSessions: string[];
  selectedType: string;
  setSelectedLocationId: (locationId: string | null) => void;
  setSelectedDate: (value: string) => void;
  setSelectedSessions: (value: string[]) => void;
  setSelectedType: (value: string) => void;
};

function HomeWorkspace({
  allBookings,
  bookings,
  currentCustomer,
  isLoading,
  locations,
  sessions,
  setView
}: {
  allBookings: Booking[];
  bookings: Booking[];
  currentCustomer: Customer;
  isLoading: boolean;
  locations: Location[];
  sessions: Session[];
  setView: (view: AppView) => void;
}) {
  const nextBooking = bookings.find((booking) => booking.status === "confirmed" || booking.status === "checked-in");
  const orderedSessions = [...sessions].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const nextSession = nextBooking ? sessions.find((session) => session.id === nextBooking.sessionId) : orderedSessions[0];
  const nextAvailable = orderedSessions[0];
  const nextLocation = nextAvailable ? locations.find((location) => location.id === (nextAvailable.locationId ?? "scarborough")) : null;
  const nextAvailableType = nextAvailable ? getSessionType(nextAvailable.typeId) : null;
  const nextBookingLocation = nextSession ? locations.find((location) => location.id === (nextSession.locationId ?? "scarborough")) : null;

  return (
    <div className="workspace-grid customer-home">
      <section className="surface welcome-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">{nextBooking && nextSession ? "Next visit" : "Book your next reset"}</p>
            <h3>{nextBooking && nextSession ? getSessionType(nextSession.typeId).name : nextAvailableType?.name ?? "Find a time"}</h3>
          </div>
          <span className="pill">{currentCustomer.credits} credits</span>
        </div>
        {nextBooking && nextSession ? (
          <div className="visit-card">
            <strong>{nextSession.date} at {nextSession.time}</strong>
            <span>{nextBookingLocation?.name ?? "Clave Bathhouse"} - {nextSession.capacity - activeBookingsFor(nextSession.id, allBookings).length} spots still open</span>
          </div>
        ) : isLoading ? (
          <div className="visit-card loading-card">
            <strong>Finding the next available session...</strong>
            <span>Checking live availability.</span>
          </div>
        ) : nextAvailable && nextAvailableType ? (
          <div className="visit-card next-available-card">
            <strong>{nextAvailable.date} at {nextAvailable.time}</strong>
            <span>{nextLocation?.name ?? "Clave Bathhouse"} - {nextAvailable.capacity - activeBookingsFor(nextAvailable.id, allBookings).length} spots open</span>
          </div>
        ) : (
          <div className="visit-card">
            <strong>Ready when you are</strong>
            <span>New times are being prepared.</span>
          </div>
        )}
        <button onClick={() => setView("book")}>Book visit</button>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Passes</p>
            <h3>{getPlan(currentCustomer.membershipId).name}</h3>
          </div>
          <span className="pill">{currentCustomer.credits} credits</span>
        </div>
        <button className="quiet" onClick={() => setView("passes")}>Manage passes</button>
      </section>
    </div>
  );
}

function CustomerWorkspace(props: CustomerWorkspaceProps) {
  const {
    allBookings,
    allSessions,
    bookingFeedback,
    busyAction,
    currentCustomer,
    handleCheckout,
    isLoading,
    locations,
    selectedDate,
    selectedLocationId,
    selectedSessions,
    selectedType,
    setSelectedLocationId,
    setSelectedDate,
    setSelectedSessions,
    setSelectedType
  } = props;

  const selectedLocation = locations.find((location) => location.id === selectedLocationId);
  const sessionsForFilters = allSessions.filter((session) => {
    const matchesLocation = !selectedLocationId || (session.locationId ?? "scarborough") === selectedLocationId;
    const matchesType = selectedType === "all" || session.typeId === selectedType;
    return matchesLocation && matchesType && isFutureSession(session);
  });
  const availableDates = Array.from(new Set(sessionsForFilters.map((session) => session.date))).sort();
  const nextAvailableDate = availableDates.find((date) => date >= selectedDate) ?? availableDates[0];
  const displayedSessions = sessionsForFilters.filter((session) => session.date === selectedDate);
  const availableDateKey = availableDates.join("|");
  const dateCounts = new Map(availableDates.map((date) => [date, sessionsForFilters.filter((session) => session.date === date).length]));
  const selectedSessionDetails = selectedSessions
    .map((sessionId) => allSessions.find((session) => session.id === sessionId))
    .filter((session): session is Session => Boolean(session));
  const selectedDue = selectedSessionDetails.reduce((sum, session, index) => {
    const full = activeBookingsFor(session.id, allBookings).length >= session.capacity;
    if (full || index < currentCustomer.credits) return sum;
    return sum + getSessionType(session.typeId).price;
  }, 0);
  const creditsApplied = Math.min(
    currentCustomer.credits,
    selectedSessionDetails.filter((session) => activeBookingsFor(session.id, allBookings).length < session.capacity).length
  );
  const waitlistSelected = selectedSessionDetails.filter((session) => activeBookingsFor(session.id, allBookings).length >= session.capacity).length;

  useEffect(() => {
    if (!selectedLocation || availableDates.length === 0 || availableDates.includes(selectedDate)) return;
    setSelectedDate(nextAvailableDate);
  }, [availableDateKey, nextAvailableDate, selectedDate, selectedLocation, setSelectedDate]);

  if (!selectedLocation) {
    return <LocationsWorkspace locations={locations} onSelectLocation={setSelectedLocationId} />;
  }

  return (
    <div className="workspace-grid customer-grid">
      <section className="surface mobile-frame">
        <div className="mobile-top">
          <div>
            <p className="eyebrow">{selectedLocation.name}</p>
            <h3>Book visit</h3>
          </div>
          <span className="pill">{currentCustomer.credits} credits</span>
        </div>
        <div className="booking-context">
          <span>{selectedLocation.address}</span>
          <button className="quiet" onClick={() => setSelectedLocationId(null)}>Change location</button>
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

        {availableDates.length > 0 && (
          <div className="date-shortcuts" aria-label="Available dates">
            {availableDates.slice(0, 6).map((date) => (
              <button className={date === selectedDate ? "active" : ""} key={date} onClick={() => setSelectedDate(date)} type="button">
                <span>{formatShortDate(date)}</span>
                <strong>{dateCounts.get(date)} session{dateCounts.get(date) === 1 ? "" : "s"}</strong>
              </button>
            ))}
          </div>
        )}

        <div className="session-list">
          {isLoading && allSessions.length === 0 && (
            <div className="empty-action availability-loading">
              <p className="muted">Checking live availability...</p>
            </div>
          )}
          {!isLoading && displayedSessions.length === 0 && (
            <div className="empty-action">
              <p className="muted">{availableDates.length === 0 ? "No sessions are published for this bathhouse yet." : "No sessions match this date and filter."}</p>
              {nextAvailableDate && nextAvailableDate !== selectedDate && (
                <button className="quiet" onClick={() => setSelectedDate(nextAvailableDate)} type="button">
                  Show {formatShortDate(nextAvailableDate)}
                </button>
              )}
            </div>
          )}
          {displayedSessions.map((session) => {
            const type = getSessionType(session.typeId);
            const activeCount = activeBookingsFor(session.id, allBookings).length;
            const bookedByMe = allBookings.some(
              (booking) =>
                booking.customerId === currentCustomer.id &&
                booking.sessionId === session.id &&
                ["confirmed", "waitlist", "checked-in"].includes(booking.status)
            );
            const full = activeCount >= session.capacity;
            const selected = selectedSessions.includes(session.id);

            return (
              <button
                className={`session-row ${selected ? "selected" : ""}`}
                disabled={bookedByMe}
                key={session.id}
                onClick={() =>
                  !bookedByMe && setSelectedSessions(selected ? selectedSessions.filter((id) => id !== session.id) : [...selectedSessions, session.id])
                }
              >
                <span>
                  <strong>{session.time}</strong>
                  <small>{type.name}</small>
                </span>
                <span>
                  <strong>{bookedByMe ? "Booked" : full ? "Waitlist" : `${session.capacity - activeCount} spots`}</strong>
                  <small>{formatCurrency(type.price)} - {type.duration} min</small>
                </span>
              </button>
            );
          })}
        </div>

        {bookingFeedback && <p className={`booking-feedback ${bookingFeedback.tone}`}>{bookingFeedback.message}</p>}

        <div className="checkout-bar">
          <div>
            <strong>{selectedDue > 0 ? `${formatCurrency(selectedDue)} due today` : creditsApplied > 0 ? "Credit will be used" : "No charge today"}</strong>
            <p>
              {selectedSessions.length} selected
              {creditsApplied > 0 ? ` - ${creditsApplied} credit${creditsApplied > 1 ? "s" : ""}` : ""}
              {waitlistSelected > 0 ? ` - ${waitlistSelected} waitlist` : ""}
            </p>
          </div>
          <button disabled={busyAction === "booking" || selectedSessions.length === 0} onClick={handleCheckout}>
            {busyAction === "booking" ? "Saving" : "Confirm"}
          </button>
        </div>
      </section>
    </div>
  );
}

function LocationsWorkspace({ locations, onSelectLocation }: { locations: Location[]; onSelectLocation: (locationId: string) => void }) {
  return (
    <div className="workspace-grid location-picker">
      <section className="surface location-intro">
        <p className="eyebrow">Book</p>
        <h3>Choose a bathhouse</h3>
        <p>Select a location first, then choose the session time that suits you.</p>
      </section>
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
          <button onClick={() => onSelectLocation(location.id)}>Book at this bathhouse</button>
        </section>
      ))}
    </div>
  );
}

function CalendarWorkspace({ bookings, sessions }: { bookings: Booking[]; sessions: Session[] }) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const datedBookings = bookings
    .map((booking) => ({ booking, session: sessionById.get(booking.sessionId) }))
    .filter((item): item is { booking: Booking; session: Session } => Boolean(item.session))
    .sort((a, b) => `${a.session.date}${a.session.time}`.localeCompare(`${b.session.date}${b.session.time}`));
  const monthSource = datedBookings[0]?.session.date ?? new Date().toISOString().slice(0, 10);
  const monthDate = new Date(`${monthSource}T00:00:00`);
  const monthLabel = monthDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const calendarCells = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];

  function bookingsForDay(day: number) {
    const date = `${monthSource.slice(0, 8)}${String(day).padStart(2, "0")}`;
    return datedBookings.filter((item) => item.session.date === date);
  }

  return (
    <div className="workspace-grid">
      <section className="surface calendar-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Calendar</p>
            <h3>{monthLabel}</h3>
          </div>
          <span className="pill">{datedBookings.length} visits</span>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {calendarCells.map((day, index) => {
            const dayBookings = day ? bookingsForDay(day) : [];
            return (
              <div className={`calendar-day ${dayBookings.length ? "has-booking" : ""}`} key={`${day ?? "blank"}-${index}`}>
                {day && <strong>{day}</strong>}
                {dayBookings.length > 0 && <span>{dayBookings.length}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Agenda</p>
            <h3>Booked visits</h3>
          </div>
        </div>
        <div className="table-list">
          {datedBookings.length === 0 && <p className="muted">No booked visits yet.</p>}
          {datedBookings.map(({ booking, session }) => (
            <div className="table-row" key={booking.id}>
              <span>{getSessionType(session.typeId).name}</span>
              <span>{session.date} {session.time}</span>
              <span className={`status ${booking.status}`}>{booking.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PassesWorkspace({
  busyAction,
  buyVoucher,
  currentCustomer,
  passFeedback,
  redeemVoucher,
  subscribe
}: {
  busyAction: BusyAction;
  buyVoucher: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  currentCustomer: Customer;
  passFeedback: { tone: "success" | "error"; message: string } | null;
  redeemVoucher: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  subscribe: (membershipId: string) => void;
}) {
  const [voucherMode, setVoucherMode] = useState<VoucherMode>("send");

  async function handleVoucherSubmit(event: FormEvent<HTMLFormElement>) {
    await buyVoucher(event);
    setVoucherMode("send");
  }

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
              <button disabled={currentCustomer.membershipId === plan.id || busyAction === "payment"} onClick={() => subscribe(plan.id)}>
                {currentCustomer.membershipId === plan.id ? "Current" : busyAction === "payment" ? "Saving" : plan.price > 0 ? "Activate" : "Switch"}
              </button>
            </article>
          ))}
        </div>
        {passFeedback && <p className={`booking-feedback ${passFeedback.tone}`}>{passFeedback.message}</p>}
      </section>

      <section className="surface voucher-card">
        <p className="eyebrow">Gift vouchers</p>
        <h3>Send bathhouse credit</h3>
        <p>Create a custom voucher for someone else, or add visit credit to your own account.</p>
        <form className="voucher-actions" onSubmit={handleVoucherSubmit}>
          <label className="voucher-value">
            Value
            <span>
              <strong>$</strong>
              <input inputMode="decimal" min="1" name="amount" placeholder="Enter amount" required type="number" />
            </span>
          </label>
          {voucherMode === "send" && (
            <label className="voucher-value">
              Recipient email
              <input name="recipientEmail" placeholder="friend@example.com" required type="email" />
            </label>
          )}
          <div className="voucher-mode" role="group" aria-label="Voucher delivery">
            <label>
              <input checked={voucherMode === "send"} name="mode" onChange={() => setVoucherMode("send")} type="radio" value="send" />
              <span>Send by email</span>
            </label>
            <label>
              <input checked={voucherMode === "credit"} name="mode" onChange={() => setVoucherMode("credit")} type="radio" value="credit" />
              <span>Add to my account</span>
            </label>
          </div>
          <button disabled={busyAction === "payment"}>{busyAction === "payment" ? "Saving" : "Buy voucher"}</button>
        </form>
      </section>

      <section className="surface voucher-card">
        <p className="eyebrow">Redeem</p>
        <h3>Add voucher credit</h3>
        <p>Enter a voucher code to add visit credit to this account.</p>
        <form className="voucher-actions" onSubmit={redeemVoucher}>
          <label className="voucher-value">
            Voucher code
            <input autoComplete="off" name="code" placeholder="CLAVE-ABC123-XY12" required />
          </label>
          <button disabled={busyAction === "payment"}>{busyAction === "payment" ? "Saving" : "Redeem voucher"}</button>
        </form>
      </section>
    </div>
  );
}

function ProfileWorkspace({
  bookings,
  busyAction,
  cancelBooking,
  currentCustomer,
  handleSignOut,
  installPromptReady,
  isOnline,
  isStandalone,
  notices,
  onInstallApp,
  pwaMessage,
  profileName,
  profilePhone,
  saveProfile,
  setProfileName,
  setProfilePhone,
  sessions,
  syncStatus
}: {
  bookings: Booking[];
  busyAction: BusyAction;
  cancelBooking: (bookingId: string) => void;
  currentCustomer: Customer;
  handleSignOut: () => void;
  installPromptReady: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  notices: Notice[];
  onInstallApp: () => void;
  pwaMessage: string;
  profileName: string;
  profilePhone: string;
  saveProfile: (event: FormEvent<HTMLFormElement>) => void;
  setProfileName: (value: string) => void;
  setProfilePhone: (value: string) => void;
  sessions: Session[];
  syncStatus: "local" | "syncing" | "synced" | "error";
}) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const visibleBookings = bookings
    .map((booking) => ({ booking, session: sessionById.get(booking.sessionId) }))
    .filter((item): item is { booking: Booking; session: Session } => Boolean(item.session));

  return (
    <div className="workspace-grid">
      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Profile</p>
            <h3>Account details</h3>
          </div>
          <span className="pill">{currentCustomer.role}</span>
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
          <button>Save profile</button>
        </form>
      </section>

      <section className="surface account-actions">
        <p className="eyebrow">Security</p>
        <h3>Signed in as {currentCustomer.name}</h3>
        <p>{currentCustomer.email}</p>
        <button className="quiet" onClick={handleSignOut}>Sign out</button>
      </section>

      <section className="surface pwa-card compact-status">
        <div className="section-head">
          <div>
            <p className="eyebrow">App</p>
            <h3>{isStandalone ? "Installed" : installPromptReady ? "Install Clave" : "Ready"}</h3>
          </div>
          <span className={`status ${isOnline ? "paid" : "waitlist"}`}>{isOnline ? "Online" : "Offline"}</span>
        </div>
        <div className="pwa-status-row">
          <span className={`status ${syncStatus === "synced" ? "paid" : syncStatus === "error" ? "waitlist" : ""}`}>
            {syncStatus === "syncing" ? "Updating" : syncStatus === "synced" ? "Ready" : syncStatus === "error" ? "Connection issue" : "Ready"}
          </span>
          <span className="pill">Saved on this device</span>
        </div>
        <p>{isStandalone ? "Clave is installed on this device." : pwaMessage}</p>
        <button className="quiet" onClick={onInstallApp}>{isStandalone ? "Installed" : "Install app"}</button>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Bookings</p>
            <h3>Your visits</h3>
          </div>
        </div>
        <div className="table-list">
          {visibleBookings.length === 0 && <p className="muted">No upcoming visits.</p>}
          {visibleBookings.map(({ booking, session }) => {
            return (
              <div className="table-row" key={booking.id}>
                <span>{getSessionType(session.typeId).name}</span>
                <span>{session.date} {session.time}</span>
                <span className={`status ${booking.status}`}>{booking.status}</span>
                {booking.status === "confirmed" || booking.status === "waitlist" ? (
                  <button className="quiet" disabled={busyAction === "cancel"} onClick={() => cancelBooking(booking.id)}>
                    {busyAction === "cancel" ? "Cancelling" : "Cancel"}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {notices.length > 0 && <NotificationRail notices={notices} />}
    </div>
  );
}

function StaffWorkspace({ bookings, checkIn, sessions }: { bookings: Booking[]; checkIn: (bookingId: string) => void; sessions: Session[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const todaysSessions = sessions
    .filter((session) => session.date >= today)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 8);

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
  adminTab: AdminTab;
  bookings: Booking[];
  busyAction: BusyAction;
  cancelBooking: (bookingId: string) => void;
  createSession: (event: FormEvent<HTMLFormElement>) => void;
  currentCustomerId: string;
  customers: Customer[];
  deleteSession: (sessionId: string) => void;
  healthStatus: HealthResponse | null;
  newCapacity: number;
  newDate: string;
  newEndDate: string;
  newLocationId: string;
  newPractitioner: string;
  newTime: string;
  newTypeId: string;
  occupancy: number;
  refund: (transactionId: string) => void;
  refreshHealth: () => void;
  sessions: Session[];
  setNewCapacity: (value: number) => void;
  setNewDate: (value: string) => void;
  setNewEndDate: (value: string) => void;
  setNewLocationId: (value: string) => void;
  setNewPractitioner: (value: string) => void;
  setNewTime: (value: string) => void;
  setNewTypeId: (value: string) => void;
  setAdminTab: (value: AdminTab) => void;
  transactions: Transaction[];
  updateCustomerRole: (customerId: string, role: Role) => void;
  updateSession: (event: FormEvent<HTMLFormElement>, sessionId: string) => void;
};

function AdminWorkspace(props: AdminWorkspaceProps) {
  const {
    adminTab,
    bookings,
    busyAction,
    cancelBooking,
    createSession,
    currentCustomerId,
    customers,
    deleteSession,
    healthStatus,
    newCapacity,
    newDate,
    newEndDate,
    newLocationId,
    newPractitioner,
    newTime,
    newTypeId,
    occupancy,
    refund,
    refreshHealth,
    sessions,
    setNewCapacity,
    setNewDate,
    setNewEndDate,
    setNewLocationId,
    setNewPractitioner,
    setNewTime,
    setNewTypeId,
    setAdminTab,
    transactions,
    updateCustomerRole,
    updateSession
  } = props;
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const [bookingFilter, setBookingFilter] = useState<BookingStatus | "all">("all");
  const [bookingSearch, setBookingSearch] = useState("");
  const [scheduleLocationFilter, setScheduleLocationFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<Role | "all">("all");
  const activeBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const waitlistBookings = bookings.filter((booking) => booking.status === "waitlist");
  const checkedInBookings = bookings.filter((booking) => booking.status === "checked-in");
  const paidTotal = transactions.filter((transaction) => transaction.status === "paid").reduce((sum, transaction) => sum + transaction.amount, 0);
  const refundedTotal = transactions.filter((transaction) => transaction.status === "refunded").reduce((sum, transaction) => sum + transaction.amount, 0);
  const filteredSessions = sessions.filter((session) => scheduleLocationFilter === "all" || (session.locationId ?? "scarborough") === scheduleLocationFilter);
  const filteredBookings = bookings.filter((booking) => {
    const session = sessionById.get(booking.sessionId);
    const haystack = `${booking.customerName} ${booking.status} ${session ? `${getSessionType(session.typeId).name} ${session.date} ${session.time}` : booking.sessionId}`.toLowerCase();
    return (bookingFilter === "all" || booking.status === bookingFilter) && haystack.includes(bookingSearch.trim().toLowerCase());
  });
  const filteredCustomers = customers.filter((customer) => {
    const haystack = `${customer.name} ${customer.email} ${customer.phone} ${customer.role} ${getPlan(customer.membershipId).name}`.toLowerCase();
    return (userRoleFilter === "all" || customer.role === userRoleFilter) && haystack.includes(userSearch.trim().toLowerCase());
  });

  return (
    <div className="workspace-grid admin-grid">
      <nav className="admin-tabs" aria-label="Admin sections">
        {[
          ["overview", "Overview"],
          ["schedule", "Schedule"],
          ["bookings", "Bookings"],
          ["users", "Users"],
          ["payments", "Payments"]
        ].map(([value, label]) => (
          <button className={adminTab === value ? "active" : ""} key={value} onClick={() => setAdminTab(value as AdminTab)}>
            {label}
          </button>
        ))}
      </nav>

      {adminTab === "overview" && (
        <>
          <section className="metric-band">
            <article>
              <span>Revenue</span>
              <strong>{formatCurrency(paidTotal)}</strong>
            </article>
            <article>
              <span>Occupancy</span>
              <strong>{Math.round(occupancy * 100)}%</strong>
            </article>
            <article>
              <span>Active bookings</span>
              <strong>{activeBookings.length}</strong>
            </article>
            <article>
              <span>Waitlist</span>
              <strong>{waitlistBookings.length}</strong>
            </article>
          </section>

          <section className="surface admin-brief">
            <div className="section-head">
              <div>
                <p className="eyebrow">Today</p>
                <h3>Operations queue</h3>
              </div>
              <span className="pill">{checkedInBookings.length} checked in</span>
            </div>
            <div className="admin-action-list">
              {waitlistBookings.slice(0, 4).map((booking) => {
                const session = sessionById.get(booking.sessionId);
                return (
                  <article key={booking.id}>
                    <span>
                      <strong>{booking.customerName}</strong>
                      <small>{session ? `${getSessionType(session.typeId).name} ${session.date} ${session.time}` : booking.sessionId}</small>
                    </span>
                    <span className="status waitlist">waitlist</span>
                  </article>
                );
              })}
              {waitlistBookings.length === 0 && <p className="empty-state">No waitlist items need attention.</p>}
            </div>
          </section>

          <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Production</p>
            <h3>Launch health</h3>
          </div>
          <span className={`status ${healthStatus?.ok ? "paid" : "waitlist"}`}>{healthStatus ? (healthStatus.ok ? "Ready" : "Needs attention") : "Checking"}</span>
        </div>
        <button className="quiet" onClick={refreshHealth}>Run check</button>
        <div className="health-grid">
          {[
            ["Database", healthStatus?.checks?.database && healthStatus?.checks?.databaseReachable],
            ["Auth secret", healthStatus?.checks?.authSecret],
            ["Email", healthStatus?.checks?.email],
            ["Google", healthStatus?.checks?.google],
            ["App URL", healthStatus?.checks?.publicAppUrl]
          ].map(([label, ok]) => (
            <div className="health-row" key={String(label)}>
              <span>{label}</span>
              <strong className={`status ${ok ? "paid" : "waitlist"}`}>{healthStatus ? (ok ? "OK" : "Missing") : "Checking"}</strong>
            </div>
          ))}
        </div>
        {healthStatus?.missing?.length ? <p className="empty-state">Missing: {healthStatus.missing.join(", ")}</p> : null}
      </section>
        </>
      )}

      {adminTab === "schedule" && (
      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Configuration</p>
            <h3>Session schedule</h3>
          </div>
        </div>
        <form className="session-form" onSubmit={createSession}>
          <select value={newLocationId} onChange={(event) => setNewLocationId(event.target.value)}>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <select value={newTypeId} onChange={(event) => setNewTypeId(event.target.value)}>
            {sessionTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <label>
            <span>Start date</span>
            <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} />
          </label>
          <label>
            <span>End date</span>
            <input type="date" value={newEndDate} onChange={(event) => setNewEndDate(event.target.value)} />
          </label>
          <input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} />
          <input type="number" min={1} max={40} value={newCapacity} onChange={(event) => setNewCapacity(Number(event.target.value))} />
          <input value={newPractitioner} onChange={(event) => setNewPractitioner(event.target.value)} placeholder="Practitioner" />
          <button>{busyAction === "session" ? "Publishing" : "Publish range"}</button>
        </form>
        <div className="admin-filter-row">
          <select value={scheduleLocationFilter} onChange={(event) => setScheduleLocationFilter(event.target.value)}>
            <option value="all">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        <div className="session-admin-list">
          {filteredSessions.map((session) => (
            <form className="session-admin-row" key={session.id} onSubmit={(event) => updateSession(event, session.id)}>
              <select defaultValue={session.locationId ?? "scarborough"} name="locationId">
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              <select defaultValue={session.typeId} name="typeId">
                {sessionTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <input defaultValue={session.date} name="date" type="date" />
              <input defaultValue={session.time} name="time" type="time" />
              <input defaultValue={session.capacity} min={1} name="capacity" type="number" />
              <input defaultValue={session.practitioner} name="practitioner" placeholder="Practitioner" />
              <span>{activeBookingsFor(session.id, bookings).length}/{session.capacity} booked, {waitlistFor(session.id, bookings).length} waitlist</span>
              <button>Save</button>
              <button className="quiet" onClick={() => deleteSession(session.id)} type="button">
                Remove
              </button>
            </form>
          ))}
        </div>
      </section>
      )}

      {adminTab === "bookings" && (
      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Operations</p>
            <h3>All bookings</h3>
          </div>
          <span className="pill">{filteredBookings.length} shown</span>
        </div>
        <div className="admin-filter-row">
          <input value={bookingSearch} onChange={(event) => setBookingSearch(event.target.value)} placeholder="Search customer or session" />
          <select value={bookingFilter} onChange={(event) => setBookingFilter(event.target.value as BookingStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="waitlist">Waitlist</option>
            <option value="checked-in">Checked in</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="table-list">
          {filteredBookings.length === 0 && <p className="empty-state">No bookings match those filters.</p>}
          {filteredBookings.map((booking) => (
            <div className="table-row" key={booking.id}>
              <span>{booking.customerName}</span>
              <span>
                {(() => {
                  const session = sessionById.get(booking.sessionId);
                  return session ? `${getSessionType(session.typeId).name} ${session.date} ${session.time}` : booking.sessionId;
                })()}
              </span>
              <span className={`status ${booking.status}`}>{booking.status}</span>
              <button className="quiet" disabled={busyAction === "cancel" || booking.status === "cancelled" || booking.status === "checked-in"} onClick={() => cancelBooking(booking.id)}>
                {busyAction === "cancel" ? "Cancelling" : "Cancel"}
              </button>
            </div>
          ))}
        </div>
      </section>
      )}

      {adminTab === "payments" && (
      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Payments</p>
            <h3>Transactions</h3>
          </div>
        </div>
        <div className="payment-summary">
          <article>
            <span>Paid</span>
            <strong>{formatCurrency(paidTotal)}</strong>
          </article>
          <article>
            <span>Refunded</span>
            <strong>{formatCurrency(refundedTotal)}</strong>
          </article>
        </div>
        <div className="table-list">
          {transactions.length === 0 && <p className="empty-state">No demo payments have been recorded yet.</p>}
          {transactions.map((transaction) => (
            <div className="table-row" key={transaction.id}>
              <span>
                <strong>{transaction.description ?? "Payment"}</strong>
                <small>{transaction.customerName ?? transaction.customerId ?? "Customer"}</small>
              </span>
              <span>{transaction.method}</span>
              <span>{formatCurrency(transaction.amount)}</span>
              <span className={`status ${transaction.status}`}>{transaction.status}</span>
              <button className="quiet" disabled={busyAction === "payment" || transaction.status === "refunded"} onClick={() => refund(transaction.id)}>
                {transaction.status === "refunded" ? "Refunded" : busyAction === "payment" ? "Saving" : "Refund"}
              </button>
            </div>
          ))}
        </div>
      </section>
      )}

      {adminTab === "users" && (
      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Users</p>
            <h3>Customer profiles</h3>
          </div>
          <span className="pill">{filteredCustomers.length} shown</span>
        </div>
        <div className="admin-filter-row">
          <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search name, email, phone" />
          <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value as Role | "all")}>
            <option value="all">All roles</option>
            <option value="customer">Customers</option>
            <option value="staff">Staff</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <div className="customer-list">
          {filteredCustomers.length === 0 && <p className="empty-state">No customers match those filters.</p>}
          {filteredCustomers.map((customer) => (
            <article key={customer.id}>
              <div>
                <strong>{customer.name}</strong>
                <span>{customer.email}</span>
                <span>{customer.phone || "No phone"} - {getPlan(customer.membershipId).name} - {customer.credits} credits</span>
                <span>{bookings.filter((booking) => booking.customerId === customer.id && booking.status !== "cancelled").length} active bookings</span>
              </div>
              <label className="customer-role-control">
                <span>Role</span>
                <select disabled={customer.id === currentCustomerId} value={customer.role} onChange={(event) => updateCustomerRole(customer.id, event.target.value as Role)}>
                  <option value="customer">Customer</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </article>
          ))}
        </div>
      </section>
      )}
    </div>
  );
}

function NotificationRail({ notices }: { notices: Notice[] }) {
  return (
    <section className="notification-rail">
      <div className="section-head">
        <div>
          <p className="eyebrow">Notifications</p>
          <h3>Recent updates</h3>
        </div>
      </div>
      <div className="notice-list">
        {notices.map((notice) => (
          <article key={notice.id}>
            <span className="channel">{notice.channel === "push" ? "app" : notice.channel}</span>
            <strong>{notice.title}</strong>
            <p>{notice.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
