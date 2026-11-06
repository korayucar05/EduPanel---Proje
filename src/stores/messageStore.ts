import { create } from "zustand";
import type { Recipient, RecipientGroup, SendMode, SmartFileMatch } from "../types/message";

const recipientKey = (recipient: Recipient) => recipient.normalized || recipient.id;
const uniqueRecipients = (items: Recipient[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = recipientKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

interface MessageState {
  recipientGroup: RecipientGroup;
  selectedClass: string;
  manualNumbers: string;
  selectedRecipients: Recipient[];
  recipientSearch: string;
  selectedSearch: string;
  sendMode: SendMode;
  message: string;
  smartFileMatches: SmartFileMatch[];
  fileMatchInfo: string;
  setRecipientGroup: (value: RecipientGroup) => void;
  setSelectedClass: (value: string) => void;
  setManualNumbers: (value: string) => void;
  setSelectedRecipients: (value: Recipient[] | ((prev: Recipient[]) => Recipient[])) => void;
  addRecipients: (items: Recipient[]) => void;
  removeRecipient: (key: string) => void;
  clearRecipients: () => void;
  setRecipientSearch: (value: string) => void;
  setSelectedSearch: (value: string) => void;
  setSendMode: (value: SendMode) => void;
  setMessage: (value: string) => void;
  setSmartFileMatches: (value: SmartFileMatch[] | ((prev: SmartFileMatch[]) => SmartFileMatch[])) => void;
  setFileMatchInfo: (value: string) => void;
  resetComposer: () => void;
  resetModule: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  recipientGroup: "",
  selectedClass: "",
  manualNumbers: "",
  selectedRecipients: [],
  recipientSearch: "",
  selectedSearch: "",
  sendMode: "text",
  message: "",
  smartFileMatches: [],
  fileMatchInfo: "",
  setRecipientGroup: (recipientGroup) => set({ recipientGroup, selectedClass: "", recipientSearch: "" }),
  setSelectedClass: (selectedClass) => set({ selectedClass }),
  setManualNumbers: (manualNumbers) => set({ manualNumbers }),
  setSelectedRecipients: (value) => set((state) => ({
    selectedRecipients: uniqueRecipients(typeof value === "function" ? value(state.selectedRecipients) : value),
  })),
  addRecipients: (items) => set((state) => ({ selectedRecipients: uniqueRecipients([...state.selectedRecipients, ...items]) })),
  removeRecipient: (key) => set((state) => ({ selectedRecipients: state.selectedRecipients.filter((item) => recipientKey(item) !== key) })),
  clearRecipients: () => set({ selectedRecipients: [], selectedSearch: "" }),
  setRecipientSearch: (recipientSearch) => set({ recipientSearch }),
  setSelectedSearch: (selectedSearch) => set({ selectedSearch }),
  setSendMode: (sendMode) => set({ sendMode }),
  setMessage: (message) => set({ message }),
  setSmartFileMatches: (value) => set((state) => ({ smartFileMatches: typeof value === "function" ? value(state.smartFileMatches) : value })),
  setFileMatchInfo: (fileMatchInfo) => set({ fileMatchInfo }),
  resetComposer: () => set({ message: "", sendMode: "text", smartFileMatches: [], fileMatchInfo: "" }),
  resetModule: () => set({
    recipientGroup: "", selectedClass: "", manualNumbers: "", selectedRecipients: [], recipientSearch: "",
    selectedSearch: "", sendMode: "text", message: "", smartFileMatches: [], fileMatchInfo: "",
  }),
}));
