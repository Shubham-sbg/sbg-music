import React from 'react';

export function GridSkeleton() {
  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full pb-20 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="h-8 bg-white/10 rounded-lg w-48"></div>
      </div>
      
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="bg-[#111112] p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between">
            <div>
              <div className="relative aspect-square rounded-xl bg-white/5 mb-3"></div>
              <div className="h-4 bg-white/10 rounded-md w-3/4 mb-2"></div>
              <div className="h-3 bg-white/5 rounded-md w-1/2"></div>
            </div>
            <div className="pt-2 border-t border-white/5 mt-4 flex gap-1.5">
              <div className="flex-1 h-8 bg-white/5 rounded-lg"></div>
              <div className="w-8 h-8 shrink-0 bg-white/5 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="flex-1 flex flex-col gap-8 lg:gap-12 max-w-7xl mx-auto w-full pb-24 animate-pulse">
      {/* Hero Section */}
      <div className="relative w-full h-[45vh] min-h-[350px] max-h-[500px] rounded-3xl bg-white/5 border border-white/5 overflow-hidden">
        <div className="absolute bottom-0 left-0 p-6 md:p-10 lg:p-14 w-full flex flex-col gap-4">
           <div className="h-4 bg-white/20 rounded-full w-24 mb-2"></div>
           <div className="h-10 md:h-14 bg-white/20 rounded-xl w-3/4 max-w-2xl"></div>
           <div className="h-4 md:h-5 bg-white/10 rounded-lg w-1/2 max-w-lg mb-4"></div>
           <div className="flex gap-3 mt-2">
             <div className="w-32 h-12 bg-white/20 rounded-xl"></div>
             <div className="w-32 h-12 bg-white/10 rounded-xl"></div>
           </div>
        </div>
      </div>
      
      {/* Top Playlists Section */}
      <div className="space-y-4">
        <div className="h-8 bg-white/10 rounded-lg w-64 mb-2"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
             <div key={i} className="h-24 bg-white/5 rounded-2xl border border-white/5"></div>
          ))}
        </div>
      </div>

      {/* Grid Section */}
      <div className="space-y-4 mt-4">
        <div className="h-8 bg-white/10 rounded-lg w-48 mb-2"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#111112] p-3.5 rounded-2xl border border-white/5">
              <div className="aspect-square rounded-xl bg-white/5 mb-3"></div>
              <div className="h-4 bg-white/10 rounded-md w-3/4 mb-2"></div>
              <div className="h-3 bg-white/5 rounded-md w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex-1 flex flex-col gap-10 max-w-7xl mx-auto w-full pb-20 animate-pulse">
      <div className="w-24 h-8 bg-white/5 rounded-full"></div>
      
      {/* Banner */}
      <div className="min-h-[280px] rounded-3xl border border-white/5 bg-white/5 p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
         <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl bg-white/10 shrink-0"></div>
         <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left gap-4 w-full">
            <div className="h-4 bg-white/10 rounded-full w-20"></div>
            <div className="h-10 md:h-12 bg-white/20 rounded-xl w-3/4 max-w-md"></div>
            <div className="h-4 bg-white/10 rounded-lg w-1/2 max-w-sm"></div>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-32 h-12 bg-white/20 rounded-full"></div>
              <div className="w-12 h-12 bg-white/10 rounded-full"></div>
              <div className="w-12 h-12 bg-white/10 rounded-full"></div>
            </div>
         </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        <div className="flex px-4 py-2 border-b border-white/10 mb-2">
          <div className="w-8 h-4 bg-white/5 rounded"></div>
          <div className="flex-1 ml-4 h-4 bg-white/5 rounded w-1/3"></div>
          <div className="w-16 h-4 bg-white/5 rounded mr-4"></div>
          <div className="w-8 h-4 bg-white/5 rounded"></div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center p-3 rounded-xl bg-white/5 border border-white/5 gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-lg shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/10 rounded w-1/3"></div>
              <div className="h-3 bg-white/5 rounded w-1/4"></div>
            </div>
            <div className="w-12 h-4 bg-white/5 rounded hidden sm:block"></div>
            <div className="w-8 h-8 bg-white/10 rounded-lg"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-pulse">
       <div className="h-10 bg-white/10 rounded-xl w-32 mb-4"></div>
       <div className="p-6 rounded-3xl bg-white/5 border border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center h-28"></div>
       
       <div className="flex gap-2">
         {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/5 rounded-xl w-28"></div>
         ))}
       </div>

       <div className="h-96 rounded-3xl bg-white/5 border border-white/5"></div>
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full pb-20 animate-pulse">
      {/* Search Header */}
      <div className="bg-[#111112] p-6 md:p-8 rounded-3xl border border-white/5 h-[200px] flex flex-col items-center justify-center gap-4">
         <div className="h-8 bg-white/20 rounded-xl w-48"></div>
         <div className="h-4 bg-white/10 rounded-lg w-64"></div>
         <div className="h-14 bg-white/10 rounded-2xl w-full max-w-2xl mt-2"></div>
         <div className="flex gap-2 mt-2">
           <div className="h-8 bg-white/10 rounded-xl w-24"></div>
           <div className="h-8 bg-white/10 rounded-xl w-32"></div>
           <div className="h-8 bg-white/10 rounded-xl w-32"></div>
         </div>
      </div>
      
      {/* Grid */}
      <div className="mt-4">
        <div className="h-8 bg-white/10 rounded-lg w-48 mb-4"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-[#111112] p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between">
              <div>
                <div className="relative aspect-square rounded-xl bg-white/5 mb-3"></div>
                <div className="h-4 bg-white/10 rounded-md w-3/4 mb-2"></div>
                <div className="h-3 bg-white/5 rounded-md w-1/2"></div>
              </div>
              <div className="pt-2 border-t border-white/5 mt-4 flex gap-1.5">
                <div className="flex-1 h-8 bg-white/5 rounded-lg"></div>
                <div className="w-8 h-8 shrink-0 bg-white/5 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
