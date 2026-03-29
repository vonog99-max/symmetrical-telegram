import { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface BotSession {
  id: string;
  token: string;
  userId?: string;
  username?: string;
  discriminator?: string;
  avatar?: string;
  status: 'offline' | 'online' | 'busy' | 'error';
  logs: string[];
}

export interface RpcConfig {
    name: string;
    details: string;
    state: string;
    largeImageKey: string;
    largeImageText: string;
    smallImageKey: string;
    smallImageText: string;
    button1Label: string;
    button1Url: string;
    button2Label: string;
    button2Url: string;
    type: string;
    url: string;
    portrait: boolean;
    startTimestamp: string;
    endTimestamp?: string;
    applicationId?: string;
}
