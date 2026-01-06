import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api, { adminAPI } from '../lib/api';
import { useNavigate } from 'react-router-dom';

interface Deal {
  id: string;
  title: string;
  organization?: {
    id: string;
    name: string;
  };
  amount?: number;
  currency: string;
  stage: string;
  probability?: number;
  expectedCloseDate?: string;
  owner?: {
    firstName: string;
    lastName: string;
  };
}

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  currency: string;
  onMarkWon?: (dealId: string) => void;
  onMarkLost?: (dealId: string) => void;
}

function DealCard({ deal, onClick, dragListeners, currency, onMarkWon, onMarkLost }: DealCardProps & { dragListeners?: any }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const handleDotsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    onClick();
  };

  const handleMarkWon = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    if (onMarkWon) {
      onMarkWon(deal.id);
    }
  };

  const handleMarkLost = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    if (onMarkLost) {
      onMarkLost(deal.id);
    }
  };

  return (
    <div className="card p-2 rounded-lg shadow-sm border border-dark-700 hover:shadow-md transition-shadow relative">
      <div ref={menuRef}>
        <button
          onClick={handleDotsClick}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1.5 right-1.5 text-gray-400 hover:text-white transition-colors p-1 z-10 cursor-pointer"
          title="Options"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="absolute top-8 right-1.5 bg-dark-800 border border-dark-700 rounded-md shadow-lg z-20 min-w-[140px]">
            <button
              onClick={handleViewDetails}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors first:rounded-t-md"
            >
              View Details
            </button>
            <button
              onClick={handleMarkWon}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full text-left px-3 py-2 text-sm text-green-400 hover:bg-dark-700 transition-colors"
            >
              ✓ Mark as Won
            </button>
            <button
              onClick={handleMarkLost}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-dark-700 transition-colors last:rounded-b-md"
            >
              ✕ Mark as Lost
            </button>
          </div>
        )}
      </div>

      <div {...dragListeners} className="cursor-grab active:cursor-grabbing">
        <h3 className="font-medium text-white mb-0.5 pr-5 text-sm">{deal.title}</h3>
        <p className="text-xs text-gray-400 mb-0.5">{deal.organization?.name || 'No organization'}</p>
        <div className="flex justify-between items-center text-sm">
          <span className="font-semibold text-green-600">{formatCurrency(deal.amount || 0)}</span>
          <span className="text-gray-400 text-xs">{deal.probability || 0}%</span>
        </div>
      </div>
    </div>
  );
}

function SortableDealCard({ deal, onClick, isJustDropped, currency, onMarkWon, onMarkLost }: DealCardProps & { isJustDropped: boolean; currency: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    animateLayoutChanges: () => false,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: isJustDropped ? 'none' : (transition || 'transform 200ms ease'),
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="outline-none">
      <DealCard deal={deal} onClick={onClick} dragListeners={listeners} currency={currency} onMarkWon={onMarkWon} onMarkLost={onMarkLost} />
    </div>
  );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className="h-full">
      {children}
    </div>
  );
}

const STAGES = [
  { id: 'LEAD', name: 'Lead', color: 'bg-gray-500/10 border border-gray-500/20' },
  { id: 'PROSPECT', name: 'Prospect', color: 'bg-blue-500/10 border border-blue-500/20' },
  { id: 'QUOTE', name: 'Quote', color: 'bg-yellow-500/10 border border-yellow-500/20' },
];

export default function PipelineBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const [optimisticStages, setOptimisticStages] = useState<Record<string, string>>({});

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminAPI.getSettings().then(r => r.data),
  });

  const { data: deals, isLoading, error } = useQuery<Deal[]>({
    queryKey: ['deals'],
    queryFn: async () => {
      const res = await api.get('/deals', { params: { limit: 1000 } });
      console.log('PipelineBoard - Deals response:', res.data);
      return res.data.data;
    },
  });

  console.log('PipelineBoard - deals data:', deals);
  console.log('PipelineBoard - isLoading:', isLoading);
  console.log('PipelineBoard - error:', error);

  const updateStageMutation = useMutation({
    mutationFn: async ({ dealId, stage, reasonLost }: { dealId: string; stage: string; reasonLost?: string }) => {
      const res = await api.patch(`/deals/${dealId}/stage`, { stage, reasonLost });
      return res.data;
    },
    onMutate: async ({ dealId, stage }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['deals'] });

      // Snapshot the previous value
      const previousDeals = queryClient.getQueryData<Deal[]>(['deals']);

      // Optimistically update to the new value
      if (previousDeals) {
        queryClient.setQueryData<Deal[]>(['deals'],
          previousDeals.map(deal =>
            deal.id === dealId ? { ...deal, stage } : deal
          )
        );
      }

      // Return a context object with the snapshotted value
      return { previousDeals };
    },
    onError: (error: any, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }
      alert('Error updating deal stage: ' + (error.response?.data?.message || error.message));
    },
    onSettled: (_data, _error, variables) => {
      // Clear the optimistic stage for this deal
      setOptimisticStages(prev => {
        const updated = { ...prev };
        delete updated[variables.dealId];
        return updated;
      });
      // Always refetch after error or success to ensure data is in sync with server
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const getDealsByStage = (stage: string) => {
    return deals?.filter((deal) => {
      const effectiveStage = optimisticStages[deal.id] ?? deal.stage;
      return effectiveStage === stage;
    }) || [];
  };

  const handleMarkWon = (dealId: string) => {
    const confirmed = window.confirm('Mark this deal as Won?');
    if (confirmed) {
      setOptimisticStages(prev => ({ ...prev, [dealId]: 'WON' }));
      updateStageMutation.mutate({ dealId, stage: 'WON' });
    }
  };

  const handleMarkLost = (dealId: string) => {
    const reasonLost = window.prompt('Please provide a reason for marking this deal as lost:');
    if (reasonLost) {
      setOptimisticStages(prev => ({ ...prev, [dealId]: 'LOST' }));
      updateStageMutation.mutate({ dealId, stage: 'LOST', reasonLost });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Clear the drag overlay immediately to prevent shadow moving back
    setActiveId(null);

    if (!over) {
      return;
    }

    const dealId = active.id as string;
    const overId = over.id as string;

    // Check if we're dropping on a stage column
    if (STAGES.some((s) => s.id === overId)) {
      const newStage = overId;
      const currentDeal = deals?.find((d) => d.id === dealId);

      // Only update if the stage actually changed
      if (currentDeal && currentDeal.stage !== newStage) {
        // Set optimistic stage IMMEDIATELY before any animations
        setOptimisticStages(prev => ({ ...prev, [dealId]: newStage }));
        setJustDroppedId(dealId);
        setTimeout(() => setJustDroppedId(null), 50);

        // If moving to LOST, prompt for reason
        if (newStage === 'LOST') {
          const reasonLost = window.prompt('Please provide a reason for marking this deal as lost:');
          if (!reasonLost) {
            // Revert optimistic update
            setOptimisticStages(prev => {
              const updated = { ...prev };
              delete updated[dealId];
              return updated;
            });
            setJustDroppedId(null);
            return; // User cancelled or didn't provide a reason
          }
          updateStageMutation.mutate({ dealId, stage: newStage, reasonLost });
        } else {
          updateStageMutation.mutate({ dealId, stage: newStage });
        }
      }
    } else {
      // Dropped on another deal - find which stage column it's in
      const targetDeal = deals?.find((d) => d.id === overId);
      if (targetDeal) {
        const currentDeal = deals?.find((d) => d.id === dealId);
        if (currentDeal && currentDeal.stage !== targetDeal.stage) {
          // Set optimistic stage IMMEDIATELY before any animations
          setOptimisticStages(prev => ({ ...prev, [dealId]: targetDeal.stage }));
          setJustDroppedId(dealId);
          setTimeout(() => setJustDroppedId(null), 50);

          // If moving to LOST, prompt for reason
          if (targetDeal.stage === 'LOST') {
            const reasonLost = window.prompt('Please provide a reason for marking this deal as lost:');
            if (!reasonLost) {
              // Revert optimistic update
              setOptimisticStages(prev => {
                const updated = { ...prev };
                delete updated[dealId];
                return updated;
              });
              setJustDroppedId(null);
              return; // User cancelled or didn't provide a reason
            }
            updateStageMutation.mutate({ dealId, stage: targetDeal.stage, reasonLost });
          } else {
            updateStageMutation.mutate({ dealId, stage: targetDeal.stage });
          }
        }
      }
    }
  };

  const activeDeal = activeId ? deals?.find((d) => d.id === activeId) : null;

  const getTotalValue = (stage: string) => {
    return deals?.reduce((sum, deal) => {
      const effectiveStage = optimisticStages[deal.id] ?? deal.stage;
      if (effectiveStage === stage) {
        return sum + (deal.amount || 0);
      }
      return sum;
    }, 0) || 0;
  };

  const formatCurrency = (amount: number) => {
    const currency = settings?.currency || 'USD';
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded">
        Error loading pipeline: {(error as any)?.message || 'Unknown error'}
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading pipeline...</div>;
  }

  if (!deals || deals.length === 0) {
    return (
      <div className="text-center py-12 card rounded-lg shadow">
        <p className="text-gray-400">No deals in the pipeline yet.</p>
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-x-auto">
        <div className="flex gap-4 p-4 min-w-max">
          {STAGES.map((stage) => {
            const stageDeals = getDealsByStage(stage.id);
            const totalValue = getTotalValue(stage.id);

            return (
              <div key={stage.id} className="flex-shrink-0 w-80">
                <DroppableColumn id={stage.id}>
                  <SortableContext items={stageDeals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                    <div className={`${stage.color} rounded-lg p-4 h-full`}>
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <h2 className="font-semibold text-white">{stage.name}</h2>
                          <span className="text-sm text-gray-400">({stageDeals.length})</span>
                        </div>
                        <p className="text-sm font-medium text-gray-300">{formatCurrency(totalValue)}</p>
                      </div>

                      <div className="space-y-3 min-h-[200px]">
                        {stageDeals.map((deal) => (
                          <SortableDealCard
                            key={deal.id}
                            deal={deal}
                            onClick={() => navigate(`/deals/${deal.id}`)}
                            isJustDropped={deal.id === justDroppedId}
                            currency={settings?.currency || 'USD'}
                            onMarkWon={handleMarkWon}
                            onMarkLost={handleMarkLost}
                          />
                        ))}
                      </div>
                    </div>
                  </SortableContext>
                </DroppableColumn>
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal ? (
          <div className="w-80">
            <DealCard deal={activeDeal} onClick={() => {}} dragListeners={undefined} currency={settings?.currency || 'USD'} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
