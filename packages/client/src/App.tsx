import { FormEvent, useMemo, useState } from "react";

type AppView = "home" | "book" | "locations" | "passes" | "me";
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
    name: "Ava Stone",
    email: "ava@example.com",
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

export function App() {
  const [view, setView] = useState<AppView>("home");
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [notices, setNotices] = useState<Notice[]>(initialNotices);
  const [selectedCustomerId, setSelectedCustomerId] = useState("c1");
  const [selectedDate, setSelectedDate] = useState("2026-05-24");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedSessions, setSelectedSessions] = useState<string[]>(["s2"]);
  const [profileName, setProfileName] = useState("Ava Stone");
  const [profilePhone, setProfilePhone] = useState("+61 400 100 200");
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

  function pushNotice(channel: Channel, title: string, body: string) {
    setNotices((current) => [{ id: `n${Date.now()}`, channel, title, body }, ...current].slice(0, 8));
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

          <nav className="mobile-tabs" aria-label="App sections">
            {(["home", "book", "locations", "passes", "me"] as AppView[]).map((item) => (
              <button className={view === item ? "active" : ""} key={item} onClick={() => setView(item)}>
                {item}
              </button>
            ))}
          </nav>

          <section className="app-scroll">
            {view === "home" && (
              <HomeWorkspace
                bookings={customerBookings}
                currentCustomer={currentCustomer}
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
                setSelectedCustomerId={setSelectedCustomerId}
                setSelectedDate={setSelectedDate}
                setSelectedSessions={setSelectedSessions}
                setSelectedType={setSelectedType}
                subscribe={subscribe}
                allBookings={bookings}
                customers={customers}
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
                {item}
              </button>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}

type CustomerWorkspaceProps = {
  allBookings: Booking[];
  bookings: Booking[];
  cancelBooking: (bookingId: string) => void;
  currentCustomer: Customer;
  customers: Customer[];
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
  setSelectedCustomerId: (value: string) => void;
  setSelectedDate: (value: string) => void;
  setSelectedSessions: (value: string[]) => void;
  setSelectedType: (value: string) => void;
  subscribe: (planId: string) => void;
};

function HomeWorkspace({
  bookings,
  currentCustomer,
  sessions,
  setView
}: {
  bookings: Booking[];
  currentCustomer: Customer;
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
    </div>
  );
}

function CustomerWorkspace(props: CustomerWorkspaceProps) {
  const {
    allBookings,
    bookings,
    cancelBooking,
    currentCustomer,
    customers,
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
    setSelectedCustomerId,
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
          <select value={currentCustomer.id} onChange={(event) => setSelectedCustomerId(event.target.value)} aria-label="Current customer">
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
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
        <p>Choose a single visit, contrast therapy pack, or dollar value voucher.</p>
        <div className="voucher-actions">
          <button>$58 visit</button>
          <button>$120 value</button>
        </div>
      </section>
    </div>
  );
}

function ProfileWorkspace({
  bookings,
  cancelBooking,
  currentCustomer,
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
