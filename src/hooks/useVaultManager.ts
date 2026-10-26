import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';

const LEGACY_STORAGE_KEY = 'netto_encrypted_vault_v2';

export const getVaultStorageKey = (userEmail: string, vaultName: string) =>
  `netto_vault_v2_${userEmail.toLowerCase().trim()}_${vaultName.trim()}`;

export const getVaultListKey = (userEmail: string) =>
  `netto_vault_list_${userEmail.toLowerCase().trim()}`;

export function useVaultManager(session: Session | null) {
  const [vaultList, setVaultList] = useState<string[]>(['Personal']);
  const [activeVaultName, setActiveVaultName] = useState<string>(() => {
    return sessionStorage.getItem('netto_active_vault_name') || 'Personal';
  });
  const [hasExistingVault, setHasExistingVault] = useState<boolean>(false);

  useEffect(() => {
    const userEmail = session?.user?.email;
    if (!userEmail) {
      setHasExistingVault(Boolean(localStorage.getItem(LEGACY_STORAGE_KEY)));
      return;
    }

    const listKey = getVaultListKey(userEmail);
    const savedListRaw = localStorage.getItem(listKey);
    let list: string[] = savedListRaw ? JSON.parse(savedListRaw) : ['Personal'];

    // Migration fallback
    const legacyVault = localStorage.getItem(LEGACY_STORAGE_KEY);
    const personalKey = getVaultStorageKey(userEmail, 'Personal');
    if (legacyVault && !localStorage.getItem(personalKey)) {
      localStorage.setItem(personalKey, legacyVault);
    }

    if (list.length === 0) list = ['Personal'];
    setVaultList(list);

    const currentVault = list.includes(activeVaultName) ? activeVaultName : list[0];
    if (currentVault !== activeVaultName) {
      setActiveVaultName(currentVault);
      sessionStorage.setItem('netto_active_vault_name', currentVault);
    }

    const activeKey = getVaultStorageKey(userEmail, currentVault);
    setHasExistingVault(Boolean(localStorage.getItem(activeKey)));
  }, [session, activeVaultName]);

  const activeStorageKey = session?.user?.email
    ? getVaultStorageKey(session.user.email, activeVaultName)
    : LEGACY_STORAGE_KEY;

  const createVaultSlot = (rawName: string) => {
    const cleaned = rawName.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleaned || !session?.user?.email) return;

    const updated = Array.from(new Set([...vaultList, cleaned]));
    setVaultList(updated);
    localStorage.setItem(getVaultListKey(session.user.email), JSON.stringify(updated));
    setActiveVaultName(cleaned);
    sessionStorage.setItem('netto_active_vault_name', cleaned);
  };

  return {
    vaultList,
    setVaultList,
    activeVaultName,
    setActiveVaultName,
    hasExistingVault,
    setHasExistingVault,
    activeStorageKey,
    createVaultSlot,
  };
}