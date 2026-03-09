import React, { useState, useEffect, useRef } from "react";
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  QrCode, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  Send,
  RefreshCw,
  Loader2,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type Contact = {
  _id: string;
  name: string;
  phone: string;
  verified: boolean;
};

type Stats = {
  total: number;
  verified: number;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "login" | "contacts" | "upload" | "composer">("dashboard");
  const [status, setStatus] = useState<string>("loading");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, verified: 0 });
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [message, setMessage] = useState("Hello {name}, this is our message.");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStatus();
    fetchStats();
    fetchContacts();
    const interval = setInterval(() => {
      if (status !== "ready") fetchStatus();
      fetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [status]);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/qr");
      const data = await res.json();
      setStatus(data.status);
      if (data.qr) setQrCode(data.qr);
    } catch (err) {
      console.error("Failed to fetch status", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {}
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      setContacts(data);
    } catch (err) {}
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploadStatus("Uploading...");
    try {
      const res = await fetch("/api/upload-contacts", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setUploadStatus(data.message || data.error);
      fetchContacts();
      fetchStats();
    } catch (err) {
      setUploadStatus("Upload failed");
    }
  };

  const startVerification = async () => {
    setIsVerifying(true);
    try {
      await fetch("/api/verify-contacts", { method: "POST" });
      alert("Verification started in background. Please wait a few minutes.");
    } catch (err) {
      alert("Failed to start verification");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendMessage = async () => {
    if (selectedContacts.length === 0) return alert("Select at least one contact");
    setIsSending(true);
    try {
      const res = await fetch("/api/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          phoneNumbers: selectedContacts
        }),
      });
      const data = await res.json();
      alert(data.message);
    } catch (err) {
      alert("Failed to send messages");
    } finally {
      setIsSending(false);
    }
  };

  const toggleContact = (phone: string) => {
    setSelectedContacts(prev => 
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };

  const selectAllVerified = () => {
    const verifiedPhones = contacts.filter(c => c.verified).map(c => c.phone);
    setSelectedContacts(verifiedPhones);
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex font-sans text-[#111B21]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#D1D7DB] flex flex-col">
        <div className="p-6 border-b border-[#D1D7DB]">
          <h1 className="text-xl font-bold flex items-center gap-2 text-[#00A884]">
            <MessageSquare className="w-6 h-6" />
            WA Marketer
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavItem 
            active={activeTab === "dashboard"} 
            onClick={() => setActiveTab("dashboard")}
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
          />
          <NavItem 
            active={activeTab === "login"} 
            onClick={() => setActiveTab("login")}
            icon={<QrCode size={20} />}
            label="WhatsApp Login"
            badge={status === "ready" ? "Connected" : "Disconnected"}
            badgeColor={status === "ready" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
          />
          <NavItem 
            active={activeTab === "upload"} 
            onClick={() => setActiveTab("upload")}
            icon={<Upload size={20} />}
            label="Upload Contacts"
          />
          <NavItem 
            active={activeTab === "contacts"} 
            onClick={() => setActiveTab("contacts")}
            icon={<Users size={20} />}
            label="Contact List"
          />
          <NavItem 
            active={activeTab === "composer"} 
            onClick={() => setActiveTab("composer")}
            icon={<Send size={20} />}
            label="Message Sender"
          />
        </nav>

        <div className="p-4 border-t border-[#D1D7DB] text-xs text-gray-400">
          v1.0.0 • Connected to MongoDB
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-semibold">Dashboard Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  title="Total Contacts" 
                  value={stats.total} 
                  icon={<Users className="text-blue-500" />} 
                  color="bg-blue-50"
                />
                <StatCard 
                  title="Verified WA" 
                  value={stats.verified} 
                  icon={<CheckCircle2 className="text-green-500" />} 
                  color="bg-green-50"
                />
                <StatCard 
                  title="Status" 
                  value={status === "ready" ? "Connected" : "Disconnected"} 
                  icon={<Database className={status === "ready" ? "text-green-500" : "text-red-500"} />} 
                  color={status === "ready" ? "bg-green-50" : "bg-red-50"}
                />
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D1D7DB]">
                <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setActiveTab("upload")}
                    className="px-4 py-2 bg-[#00A884] text-white rounded-lg hover:bg-[#008F6F] transition-colors flex items-center gap-2"
                  >
                    <Upload size={18} /> Upload New List
                  </button>
                  <button 
                    onClick={startVerification}
                    disabled={isVerifying || status !== "ready"}
                    className="px-4 py-2 border border-[#00A884] text-[#00A884] rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isVerifying ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                    Verify WhatsApp Numbers
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "login" && (
            <motion.div 
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg border border-[#D1D7DB] text-center"
            >
              <h2 className="text-2xl font-bold mb-2">WhatsApp Login</h2>
              <p className="text-gray-500 mb-8">Scan the QR code with your WhatsApp app to connect.</p>
              
              <div className="flex justify-center mb-8">
                {status === "ready" ? (
                  <div className="flex flex-col items-center gap-4 text-green-600">
                    <div className="w-48 h-48 bg-green-50 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={80} />
                    </div>
                    <p className="font-semibold text-xl">Connected Successfully!</p>
                  </div>
                ) : qrCode ? (
                  <div className="p-4 bg-white border-2 border-[#00A884] rounded-xl">
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                  </div>
                ) : (
                  <div className="w-64 h-64 bg-gray-100 rounded-xl flex items-center justify-center flex-col gap-4">
                    <Loader2 className="animate-spin text-[#00A884]" size={40} />
                    <p className="text-sm text-gray-400">Generating QR Code...</p>
                  </div>
                )}
              </div>

              <div className="text-left space-y-3 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-800">Instructions:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap Menu or Settings and select Linked Devices</li>
                  <li>Tap on Link a Device</li>
                  <li>Point your phone to this screen to capture the code</li>
                </ol>
              </div>
            </motion.div>
          )}

          {activeTab === "upload" && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-2xl mx-auto"
            >
              <h2 className="text-2xl font-semibold mb-6">Upload Contact List</h2>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#D1D7DB] rounded-2xl p-12 text-center hover:border-[#00A884] hover:bg-green-50 transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-100 transition-colors">
                  <Upload className="text-gray-400 group-hover:text-[#00A884]" size={32} />
                </div>
                <h3 className="text-lg font-medium mb-1">Click to upload or drag and drop</h3>
                <p className="text-gray-400 text-sm mb-4">Supported formats: .csv, .xlsx, .xls</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleUpload} 
                  className="hidden" 
                  accept=".csv,.xlsx,.xls"
                />
                <div className="inline-block px-4 py-2 bg-white border border-[#D1D7DB] rounded-lg text-sm font-medium">
                  Select File
                </div>
              </div>

              {uploadStatus && (
                <div className={`mt-6 p-4 rounded-lg flex items-center gap-3 ${uploadStatus.includes("Successfully") ? "bg-green-50 text-green-700 border border-green-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                  {uploadStatus.includes("Successfully") ? <CheckCircle2 size={20} /> : <Loader2 className="animate-spin" size={20} />}
                  {uploadStatus}
                </div>
              )}

              <div className="mt-12 bg-white p-6 rounded-2xl border border-[#D1D7DB]">
                <h4 className="font-medium mb-4">File Format Requirements</h4>
                <div className="grid grid-cols-2 gap-8 text-sm text-gray-600">
                  <div>
                    <p className="font-semibold mb-2 text-gray-800">Required Columns:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>phone (or Phone/Mobile)</li>
                      <li>name (optional, defaults to Unknown)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-2 text-gray-800">Phone Format:</p>
                    <p>Numbers should include country code without '+' or '00'. Example: 919876543210</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "contacts" && (
            <motion.div 
              key="contacts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Contact List</h2>
                <div className="flex gap-3">
                  <button 
                    onClick={selectAllVerified}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Select All Verified
                  </button>
                  <button 
                    onClick={() => setSelectedContacts([])}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#D1D7DB] overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-[#D1D7DB]">
                    <tr>
                      <th className="px-6 py-4 font-medium text-gray-500 text-sm">Select</th>
                      <th className="px-6 py-4 font-medium text-gray-500 text-sm">Name</th>
                      <th className="px-6 py-4 font-medium text-gray-500 text-sm">Phone</th>
                      <th className="px-6 py-4 font-medium text-gray-500 text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D1D7DB]">
                    {contacts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                          No contacts found. Upload a list to get started.
                        </td>
                      </tr>
                    ) : (
                      contacts.map((contact) => (
                        <tr key={contact._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              checked={selectedContacts.includes(contact.phone)}
                              onChange={() => toggleContact(contact.phone)}
                              className="w-4 h-4 rounded border-gray-300 text-[#00A884] focus:ring-[#00A884]"
                            />
                          </td>
                          <td className="px-6 py-4 font-medium">{contact.name}</td>
                          <td className="px-6 py-4 text-gray-500">{contact.phone}</td>
                          <td className="px-6 py-4">
                            {contact.verified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle2 size={12} /> Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                <XCircle size={12} /> Unverified
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "composer" && (
            <motion.div 
              key="composer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              <div className="md:col-span-2 space-y-6">
                <h2 className="text-2xl font-semibold">Compose Message</h2>
                <div className="bg-white p-6 rounded-2xl border border-[#D1D7DB] shadow-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message Content</label>
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={8}
                    className="w-full p-4 border border-[#D1D7DB] rounded-xl focus:ring-2 focus:ring-[#00A884] focus:border-transparent outline-none resize-none"
                    placeholder="Type your message here..."
                  />
                  <div className="mt-2 text-xs text-gray-400 flex justify-between">
                    <span>Use {"{name}"} for personalization</span>
                    <span>{message.length} characters</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-[#D1D7DB] shadow-sm">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Users size={18} /> Recipients ({selectedContacts.length})
                  </h3>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                    {selectedContacts.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No contacts selected. Go to Contact List to select recipients.</p>
                    ) : (
                      selectedContacts.map(phone => (
                        <span key={phone} className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium flex items-center gap-1">
                          {phone}
                          <button onClick={() => toggleContact(phone)} className="hover:text-red-500">×</button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <button 
                  onClick={handleSendMessage}
                  disabled={isSending || selectedContacts.length === 0 || status !== "ready"}
                  className="w-full py-4 bg-[#00A884] text-white rounded-xl font-bold text-lg hover:bg-[#008F6F] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-100"
                >
                  {isSending ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                  {isSending ? "Sending Batch..." : `Send to ${selectedContacts.length} Contacts`}
                </button>
              </div>

              <div className="space-y-6">
                <h2 className="text-2xl font-semibold opacity-0">Preview</h2>
                <div className="bg-[#E5DDD5] rounded-3xl overflow-hidden shadow-xl border border-[#D1D7DB] aspect-[9/16] relative">
                  <div className="bg-[#075E54] p-4 text-white flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Preview Recipient</p>
                      <p className="text-[10px] opacity-70">online</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm max-w-[85%] relative">
                      <p className="text-sm whitespace-pre-wrap">
                        {message.replace(/{name}/g, "John Doe")}
                      </p>
                      <span className="text-[10px] text-gray-400 block text-right mt-1">10:42 AM</span>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#F0F2F5] flex items-center gap-2">
                    <div className="flex-1 bg-white h-10 rounded-full" />
                    <div className="w-10 h-10 bg-[#00A884] rounded-full flex items-center justify-center text-white">
                      <Send size={18} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, badge, badgeColor }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
        active 
          ? "bg-green-50 text-[#00A884] font-semibold" 
          : "text-gray-500 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      {badge && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeColor}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-[#D1D7DB] shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
        {React.cloneElement(icon, { size: 24 })}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
