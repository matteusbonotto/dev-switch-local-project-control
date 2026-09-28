import git from './git.js';
import github from './github.js';
import supabase from './supabase.js';
import firebase from './firebase.js';

// Para adicionar uma integração: crie um adapter com o mesmo contrato e inclua aqui.
export function createRegistry(list = [git, github, supabase, firebase]) {
  return {
    list: () => list,
    get: (id) => list.find((a) => a.id === id),
    meta: () => list.map(({ id, label, icon, section, description, fields }) => ({ id, label, icon, section, description, fields })),
  };
}
