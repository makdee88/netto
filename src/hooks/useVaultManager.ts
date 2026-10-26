import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';

const LEGACY_STORAGE_KEY = 'netto_encrypted_vault_v2';

export const getVaultStorageKey = (userEmail: string, vaultName: string) =>
  `netto_vault_v2_${userEmail.toLowerCase().trim()}_${vaultName.trim()}`;

export const getVaultListKey = (userEmail: string) =>
  `netto_vault_list_${userEmail.toLowerCase().trim()}`;

export function useVaultManager(session: Session | null) {
  const userEmail = session?.user?.email || '';
  const defaultVaultName = userEmail || 'Personal';

  const [vaultList, setVaultList] = useState<string[]>([defaultVaultName]);
  const [activeVaultName, setActiveVaultName] = useState<string>(() => {
    return sessionStorage.getItem('netto_active_vault_name') || defaultVaultName;
  });
  const [hasExistingVault, setHasExistingVault] = useState<boolean>(false);

  useEffect(() => {
    if (!userEmail) {
      setHasExistingVault(Boolean(localStorage.getItem(LEGACY_STORAGE_KEY)));
      return;
    }

    const listKey = getVaultListKey(userEmail);
    const savedListRaw = localStorage.getItem(listKey);
    let list: string[] = savedListRaw ? JSON.parse(savedListRaw) : [userEmail];

    // Auto-migrate legacy un-namespaced vault to user's primary email vault if exists
    const legacyVault = localStorage.getItem(LEGACY_STORAGE_KEY);
    const emailVaultKey = getVaultStorageKey(userEmail, userEmail);
    if (legacyVault && !localStorage.getItem(emailVaultKey)) {
      localStorage.setItem(emailVaultKey, legacyVault);
    }

    if (!list.includes(userEmail)) {
      list = [userEmail, ...list];
    }

    setVaultList(list);

    // If current selected name isn't set or is generic 'Personal', prefer user's email
    const savedActive = sessionStorage.getItem('netto_active_vault_name');
    const selected = savedActive && list.includes(savedActive) ? savedActive : userEmail;

    setActiveVaultName(selected);
    sessionStorage.setItem('netto_active_vault_name', selected);

    const activeKey = getVaultStorageKey(userEmail, selected);
    setHasExistingVault(Boolean(localStorage.getItem(activeKey)));
  }, [userEmail]);

  const activeStorageKey = userEmail
    ? getVaultStorageKey(userEmail, activeVaultName)
    : LEGACY_STORAGE_KEY;

  const createVaultSlot = (rawName: string) => {
    const cleaned = rawName.replace(/[^a-zA-Z0-9_@.-]/g, '');
    if (!cleaned || !userEmail) return;

    const updated = Array.from(new Set([...vaultList, cleaned]));
    setVaultList(updated);
    localStorage.setItem(getVaultListKey(userEmail), JSON.stringify(updated));
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