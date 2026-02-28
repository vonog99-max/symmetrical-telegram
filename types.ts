import { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface BotSession {
  id: string;
  token: string;
  username?: string;
  discriminator?: string;
  avatar?: string;
  status: 'offline' | 'online' | 'busy' | 'error';
  logs: string[];
}
