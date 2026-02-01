import { Button, Card, CardContent } from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Plus, Star, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { SequenceMap } from "../../components/map/sequence-map";
import { DeleteConfirmationDialog } from "../../components/ux/delete-confirmation-dialog";
import { sessionQueryOptions } from "../../lib/queries/session";
import { api } from "../../lib/trpc";

export const Route = createFileRoute("/(app)/paths")({
  component: PathsPage,
  // Preload session to check auth status (but don't require it)
  loader: async ({ context }) => {
    try {
      const session = await context.queryClient.fetchQuery(
        sessionQueryOptions(),
      );
      return { session };
    } catch {
      return { session: null };
    }
  },
});

function PathsPage() {
  const { data: rawPaths, isLoading } = useQuery(
    api.path.search.queryOptions({ limit: 50 }),
  );

  // Convert score from string to number and ensure geometry is properly typed for PathMap component
  const paths = rawPaths?.map((path: any) => ({
    ...path,
    score: path.score ? parseFloat(path.score) : null,
    geometry: path.geometry as {
      type: "LineString";
      coordinates: [number, number][];
    },
  })) || [];

  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pathToDeleteId, setPathToDeleteId] = useState<string | null>(null);
  const [pathToDeleteName, setPathToDeleteName] = useState("");

  const deletePath = useMutation(
    api.path.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: api.path.search.queryKey({ limit: 50 }),
        });
        setDeleteDialogOpen(false);
        setPathToDeleteId(null);
      },
      onError: (error) => {
        console.error("Failed to delete path:", error);
        alert("Failed to delete path");
      }
    }),
  );

  const confirmDelete = () => {
    if (pathToDeleteId) {
      deletePath.mutate({ id: pathToDeleteId });
    }
  };

  const loaderData = Route.useLoaderData();
  const isAuthenticated = loaderData?.session?.user != null;
  const currentUserId = loaderData?.session?.user?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-6 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Discover Bike Paths</h2>
            <p className="text-muted-foreground">
              Explore crowd-sourced bike path conditions in your area
            </p>
          </div>
          {isAuthenticated && (
            <Link to="/report">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Report Path Condition
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <p className="text-muted-foreground">Loading paths...</p>
          </div>
        )}

        {!isLoading && paths && paths.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No paths yet</h3>
                <p className="text-muted-foreground mb-4">
                  {isAuthenticated
                    ? "Be the first to report a bike path condition!"
                    : "Sign in to start reporting bike path conditions!"}
                </p>
                {!isAuthenticated && (
                  <Link to="/login" search={{ redirect: "/paths" }}>
                    <Button>Sign In</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {!isLoading && paths && paths.length > 0 && (
          <SequenceMap
            paths={paths.map((path: any) => ({
              id: path.id,
              name: path.name,
              routes: [{
                ...path,
                currentStatus: path.currentStatus,
              }],
            }))}
            obstacles={
              // Combine all obstacles from all paths
              paths.flatMap((path: any) =>
                (path.obstacles || []).map((o: any) => ({
                  id: o.id,
                  type: o.type,
                  description: o.description,
                  lat: parseFloat(o.lat),
                  lon: parseFloat(o.lon),
                }))
              )
            }
          />
        )}
      </div>

      {/* Path List Section - Show for management */}
      {!isLoading && paths && paths.length > 0 && (
        <div className="shrink-0 p-6 bg-slate-50 border-t max-h-64 overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Path Directory</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {paths.map((p: any) => (
              <div key={p.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Zap className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase">{p.name}</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Star className="h-2 w-2 fill-amber-400 text-amber-400" />
                      {p.score ? `${Number(p.score).toFixed(1)}/5 rating` : "No rating"}
                    </p>
                  </div>
                </div>
                {isAuthenticated && p.tripOwnerId === currentUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-300 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setPathToDeleteId(p.id);
                      setPathToDeleteName(p.name);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guest CTA Banner */}
      {!isAuthenticated && paths && paths.length > 0 && (
        <div className="shrink-0 p-4 bg-primary text-primary-foreground">
          <div className="container mx-auto flex justify-between items-center">
            <p className="text-sm">
              Want to contribute path reports and track your trips?
            </p>
            <Link to="/login" search={{ redirect: "/paths" }}>
              <Button variant="secondary" size="sm">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      )}

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Community Path"
        description={`Are you sure you want to delete "${pathToDeleteName}"? This will remove it from the community map for everyone.`}
        isLoading={deletePath.isPending}
      />
    </div>
  );
}
