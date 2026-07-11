import { create } from 'zustand';

import type { Idea } from '@/models/idea';
import { storageService } from '@/services/sqlite-storage-service';

interface IdeasState {
  ideas: Idea[];
  isLoaded: boolean;
  loadIdeas: () => Promise<void>;
  createIdea: () => Promise<Idea>;
  renameIdea: (id: string, title: string) => Promise<void>;
  updateLyrics: (id: string, lyrics: string) => Promise<void>;
  updateSettings: (
    id: string,
    changes: Partial<Pick<Idea, 'tempo' | 'timeSignature' | 'loopLengthBars' | 'metronomeEnabled'>>,
  ) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
}

export const useIdeasStore = create<IdeasState>((set, get) => ({
  ideas: [],
  isLoaded: false,

  loadIdeas: async () => {
    const ideas = await storageService.listIdeas();
    set({ ideas, isLoaded: true });
  },

  createIdea: async () => {
    const idea = await storageService.createIdea({ title: 'New Idea' });
    await get().loadIdeas();
    return idea;
  },

  renameIdea: async (id, title) => {
    await storageService.renameIdea(id, title);
    await get().loadIdeas();
  },

  updateLyrics: async (id, lyrics) => {
    await storageService.updateIdea(id, { lyrics });
    await get().loadIdeas();
  },

  updateSettings: async (id, changes) => {
    await storageService.updateIdea(id, changes);
    await get().loadIdeas();
  },

  deleteIdea: async (id) => {
    await storageService.deleteIdea(id);
    await get().loadIdeas();
  },
}));
