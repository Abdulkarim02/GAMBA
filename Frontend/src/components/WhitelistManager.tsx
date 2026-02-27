import { useState, useEffect } from "react";
import { dbManager } from "../db/repository";
import { Webpage } from "../db/schema";

// Domain interface now matches Webpage from schema
type Domain = Webpage;

const ArrowLeftIcon = ({ isDarkMode }: { isDarkMode: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9.99999 15.8333L4.16666 10L9.99999 4.16666" stroke={isDarkMode ? "#CAD5E2" : "#62748E"} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.8333 10H4.16666" stroke={isDarkMode ? "#CAD5E2" : "#62748E"} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PlusIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.16669 10H15.8334" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 4.16667V15.8333" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SearchIcon = ({ isDarkMode }: { isDarkMode: boolean }) => (
    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.8297 13.4984L10.1782 10.847" stroke={isDarkMode ? "#62748E" : "#4A5568"} strokeWidth="1.22188" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.72032 12.2766C9.41962 12.2766 11.6078 10.0883 11.6078 7.38906C11.6078 4.68976 9.41962 2.50156 6.72032 2.50156C4.02103 2.50156 1.83282 4.68976 1.83282 7.38906C1.83282 10.0883 4.02103 12.2766 6.72032 12.2766Z" stroke={isDarkMode ? "#62748E" : "#4A5568"} strokeWidth="1.22188" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PencilIcon = ({ isDarkMode }: { isDarkMode: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#pencil-clip)">
            <path d="M14.116 4.54132C14.4685 4.18894 14.6665 3.71097 14.6666 3.21256C14.6666 2.71415 14.4687 2.23613 14.1163 1.88366C13.7639 1.53118 13.286 1.33313 12.7876 1.33307C12.2892 1.33301 11.8111 1.53094 11.4587 1.88332L2.56133 10.7827C2.40654 10.937 2.29207 11.127 2.228 11.336L1.34733 14.2373C1.3301 14.295 1.3288 14.3562 1.34356 14.4146C1.35833 14.4729 1.38861 14.5261 1.43119 14.5687C1.47378 14.6112 1.52708 14.6414 1.58544 14.656C1.64379 14.6707 1.70504 14.6693 1.76266 14.652L4.66466 13.772C4.87344 13.7085 5.06345 13.5947 5.218 13.4407L14.116 4.54132Z" stroke={isDarkMode ? "#90A1B9" : "#62748E"} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 3.33334L12.6667 6.00001" stroke={isDarkMode ? "#90A1B9" : "#62748E"} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <defs>
            <clipPath id="pencil-clip">
                <rect width="16" height="16" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

const TrashIcon = ({ isDarkMode }: { isDarkMode: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.66669 7.33334V11.3333" stroke={isDarkMode ? "#90A1B9" : "#62748E"} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.33331 7.33334V11.3333" stroke={isDarkMode ? "#90A1B9" : "#62748E"} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.6666 4V13.3333C12.6666 13.687 12.5262 14.0261 12.2761 14.2761C12.0261 14.5262 11.6869 14.6667 11.3333 14.6667H4.66665C4.31302 14.6667 3.97389 14.5262 3.72384 14.2761C3.47379 14.0261 3.33331 13.687 3.33331 13.3333V4" stroke={isDarkMode ? "#90A1B9" : "#62748E"} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 4H14" stroke={isDarkMode ? "#90A1B9" : "#62748E"} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.33331 4.00001V2.66668C5.33331 2.31305 5.47379 1.97392 5.72384 1.72387C5.97389 1.47382 6.31302 1.33334 6.66665 1.33334H9.33331C9.68694 1.33334 10.0261 1.47382 10.2761 1.72387C10.5262 1.97392 10.6666 2.31305 10.6666 2.66668V4.00001" stroke={isDarkMode ? "#90A1B9" : "#62748E"} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CheckIcon = ({ isDarkMode }: { isDarkMode: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.66669 8L6.00002 11.3333L13.3334 4" stroke={isDarkMode ? "#90A1B9" : "#62748E"} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

interface WhitelistManagerProps {
    isDarkMode: boolean;
    onBack: () => void;
}

export default function WhitelistManager({ isDarkMode, onBack }: WhitelistManagerProps) {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [searchValue, setSearchValue] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const CONFIG_ID = 1; // Default config ID

    // Load whitelist from database
    const loadWhitelist = async () => {
        try {
            const data = await dbManager.getWhitelist(CONFIG_ID);
            setDomains(data);
        } catch (error) {
            console.error("Failed to load whitelist:", error);
        }
    };

    useEffect(() => {
        loadWhitelist();
    }, []);

    // Helper to extract base hostname (e.g., google.com/test -> google.com)
    const normalizeUrl = (input: string): string | null => {
        let url = input.trim();
        if (!url) return null;
        if (!url.includes("://")) url = "https://" + url;
        try {
            const parsed = new URL(url);
            let hostname = parsed.hostname.toLowerCase();
            // Optional: remove 'www.' to keep it clean
            hostname = hostname.replace(/^www\./, "");
            // Basic validation: must have a TLD (at least one dot)
            return (hostname.includes(".") && hostname.length > 3) ? hostname : null;
        } catch {
            return null;
        }
    };

    const filteredDomains = domains.filter((d) =>
        d.BaseURL.toLowerCase().includes(searchValue.toLowerCase())
    );

    const handleAdd = async () => {
        const normalized = normalizeUrl(inputValue);
        if (!normalized) {
            // Basic UI feedback for invalid domains
            if (inputValue.trim()) alert("Please enter a valid domain (e.g., google.com)");
            return;
        }

        try {
            const success = await dbManager.addWebpageToWhitelist(CONFIG_ID, normalized);
            if (success) {
                await loadWhitelist();
                setInputValue("");
            }
        } catch (error) {
            console.error("Failed to add domain:", error);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await dbManager.removeWebpageFromWhitelist(CONFIG_ID, id);
            await loadWhitelist();
        } catch (error) {
            console.error("Failed to delete domain:", error);
        }
    };

    const handleEditStart = (domain: Domain) => {
        if (domain.webpage_id) {
            setEditingId(domain.webpage_id);
            setEditValue(domain.BaseURL);
        }
    };

    const handleEditSave = async (id: number) => {
        const normalized = normalizeUrl(editValue);
        if (normalized) {
            try {
                // dbManager doesn't have an updateWebpage handler, so we remove and add for now
                await dbManager.removeWebpageFromWhitelist(CONFIG_ID, id);
                await dbManager.addWebpageToWhitelist(CONFIG_ID, normalized);
                await loadWhitelist();
            } catch (error) {
                console.error("Failed to update domain:", error);
            }
        }
        setEditingId(null);
        setEditValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === "Enter") action();
    };

    return (
        <div className="h-full flex flex-col relative overflow-hidden">
            {/* Content Container */}
            <div className={`w-full h-full flex flex-col relative ${isDarkMode ? 'bg-slate-900' : 'bg-[#F0F1F5]'}`}>
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 pointer-events-none bg-wl-overlay opacity-10" />

                <div className="relative z-10 p-6 flex flex-col gap-0 h-full">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-8">
                        <button
                            onClick={onBack}
                            className={`w-8 h-8 flex items-center justify-center rounded-[10px] transition-colors flex-shrink-0 ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                            aria-label="Go back"
                        >
                            <ArrowLeftIcon isDarkMode={isDarkMode} />
                        </button>
                        <h1 className={`font-semibold text-[20px] leading-7 ${isDarkMode ? 'text-white' : 'text-[#0D141F]'}`}>
                            Manage Whitelist
                        </h1>
                    </div>

                    {/* Add New Website */}
                    <div className="mb-[26px]">
                        <label className={`block text-[12px] font-semibold leading-4 tracking-[0.6px] uppercase mb-3 ${isDarkMode ? 'text-[#90A1B9]' : 'text-[#62748E]'}`}>
                            Add New Website
                        </label>
                        <div className="flex items-center gap-2">
                            <div className={`flex-1 rounded-[10px] border ${isDarkMode ? 'border-[#314158] bg-[rgba(29,41,61,0.50)]' : 'bg-white border-[#E2E8F0]'}`}>
                                <input
                                    type="text"
                                    placeholder="example.com"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, handleAdd)}
                                    className={`w-full h-12 px-4 bg-transparent text-[14px] font-normal outline-none rounded-[10px] ${isDarkMode ? 'text-[#62748E] placeholder-[#62748E]' : 'text-[#0D141F] placeholder-[#90A1B9]'}`}
                                />
                            </div>
                            <button
                                onClick={handleAdd}
                                className="w-12 h-12 flex items-center justify-center rounded-[10px] bg-[#007AFF] shadow-[0_10px_15px_-3px_rgba(0,122,255,0.30),0_4px_6px_-4px_rgba(0,122,255,0.30)] hover:bg-[#0066DD] active:scale-95 transition-all flex-shrink-0"
                                aria-label="Add domain"
                            >
                                <PlusIcon />
                            </button>
                        </div>
                    </div>

                    {/* Whitelisted Domains */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {/* Section header */}
                        <div className="flex items-center justify-between mb-[14px]">
                            <span className={`text-[12px] font-semibold leading-4 tracking-[0.6px] uppercase ${isDarkMode ? 'text-[#90A1B9]' : 'text-[#62748E]'}`}>
                                Whitelisted Domains
                            </span>
                            <span className="flex items-center justify-center rounded-[8px] bg-[#007AFF] px-2 py-1 text-white text-[12px] font-semibold leading-4 min-w-[22px]">
                                {domains.length}
                            </span>
                        </div>

                        {/* Search */}
                        <div className={`rounded-[10px] border flex items-center gap-3 px-4 h-[46px] mb-3 ${isDarkMode ? 'border-[#314158] bg-[rgba(29,41,61,0.50)]' : 'bg-white border-[#E2E8F0]'}`}>
                            <SearchIcon isDarkMode={isDarkMode} />
                            <input
                                type="text"
                                placeholder="Search whitelisted domains..."
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className={`flex-1 bg-transparent text-[14px] font-normal outline-none ${isDarkMode ? 'text-[#62748E] placeholder-[#62748E]' : 'text-[#0D141F] placeholder-[#90A1B9]'}`}
                            />
                        </div>

                        {/* Domain list */}
                        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-0 scrollbar-hide min-h-0">
                            {filteredDomains.length === 0 && (
                                <div className="text-[#62748E] text-[14px] text-center py-6">
                                    {searchValue ? "No matching domains found." : "No domains added yet."}
                                </div>
                            )}
                            {filteredDomains.map((domain) => (
                                <div
                                    key={domain.webpage_id}
                                    className={`flex items-center justify-between px-4 rounded-[10px] border h-[66px] flex-shrink-0 ${isDarkMode ? 'border-[#314158] bg-[rgba(29,41,61,0.50)]' : 'bg-white border-[#E2E8F0] shadow-sm'}`}
                                >
                                    {/* Left: favicon + domain name / edit input */}
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                            <img
                                                src={`https://www.google.com/s2/favicons?domain=${domain.BaseURL}&sz=64`}
                                                alt=""
                                                className="w-6 h-6 object-contain"
                                                onError={(e) => {
                                                    // Fallback to a generic globe icon if image fails
                                                    (e.target as HTMLImageElement).src = "https://www.google.com/s2/favicons?domain=about:blank&sz=64";
                                                }}
                                            />
                                        </div>
                                        {editingId === domain.webpage_id ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onKeyDown={(e) =>
                                                    handleKeyDown(e, () => {
                                                        if (domain.webpage_id) handleEditSave(domain.webpage_id);
                                                    })
                                                }
                                                autoFocus
                                                className={`flex-1 bg-transparent text-[16px] font-medium outline-none border-b min-w-0 ${isDarkMode ? 'text-white border-[#62748E]' : 'text-[#0D141F] border-[#90A1B9]'}`}
                                            />
                                        ) : (
                                            <span className={`text-[16px] font-medium leading-6 truncate ${isDarkMode ? 'text-white' : 'text-[#0D141F]'}`}>
                                                {domain.BaseURL}
                                            </span>
                                        )}
                                    </div>

                                    {/* Right: action buttons */}
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                        {editingId === domain.webpage_id ? (
                                            <button
                                                onClick={() => domain.webpage_id && handleEditSave(domain.webpage_id)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-[10px] transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                                                aria-label="Save edit"
                                            >
                                                <CheckIcon isDarkMode={isDarkMode} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleEditStart(domain)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-[10px] transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                                                aria-label={`Edit ${domain.BaseURL}`}
                                            >
                                                <PencilIcon isDarkMode={isDarkMode} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => domain.webpage_id && handleDelete(domain.webpage_id)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-[10px] transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                                            aria-label={`Delete ${domain.BaseURL}`}
                                        >
                                            <TrashIcon isDarkMode={isDarkMode} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
