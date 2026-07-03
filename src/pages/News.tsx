import React from 'react';
import { useGameStore } from '../store/gameStore';

export default function News() {
  const { news, storylines } = useGameStore();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-black text-white uppercase">News & Storylines</h1>
      
      {storylines.filter(s => s.isActive).length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-3">Active Storylines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {storylines.filter(s => s.isActive).map(s => (
              <div key={s.id} className="bg-neutral-900 border border-neutral-800 rounded p-3">
                 <div className="flex justify-between items-start">
                   <h3 className="font-bold text-white">{s.type}</h3>
                 </div>
                 <p className="text-xs text-neutral-400 mt-1">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-3">Recent News Feed</h2>
      <div className="space-y-4">
        {news.length === 0 ? (
          <div className="text-neutral-500">No news yet.</div>
        ) : (
          news.map(item => (
            <div key={item.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex gap-4">
              <div className="flex-shrink-0 w-24 text-sm text-neutral-500 font-mono pt-1">
                {item.date}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white text-lg">{item.title}</h3>
                <p className="text-neutral-400 mt-1">{item.content}</p>
                <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-950 text-neutral-500 border border-neutral-800">
                  {item.type}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
