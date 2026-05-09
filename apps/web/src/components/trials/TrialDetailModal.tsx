import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Calendar, Package, User, CheckCircle, Star } from 'lucide-react';
import { format } from 'date-fns';
import { trialService } from '../../services/trial.service';
import { API_BASE_URL } from '../../lib/axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface TrialDetailModalProps {
  trialId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Helper function to get full image URL
const getImageUrl = (relativePath: string) => {
  // Remove /api/v1 from API_BASE_URL and just use the base server URL
  const baseUrl = API_BASE_URL.replace('/api/v1', '');
  return `${baseUrl}${relativePath}`;
};

// Helper function to check if file is a video
const isVideoFile = (url: string) => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mpeg', '.mpg'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

export default function TrialDetailModal({ trialId, isOpen, onClose }: TrialDetailModalProps) {
  const queryClient = useQueryClient();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [finalComments, setFinalComments] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isSuccessful, setIsSuccessful] = useState<boolean | null>(null);

  const { data: trial, isLoading } = useQuery({
    queryKey: ['trial', trialId],
    queryFn: () => trialService.getById(trialId),
    enabled: isOpen && !!trialId,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      return trialService.update(trialId, {
        status: 'COMPLETED',
        comments: finalComments || trial?.comments,
        rating,
        is_successful: isSuccessful,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial', trialId] });
      queryClient.invalidateQueries({ queryKey: ['trials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Trial marked as completed');
      setShowCompleteDialog(false);
      setFinalComments('');
      setRating(0);
      setIsSuccessful(null);
      onClose();
    },
    onError: () => {
      toast.error('Failed to complete trial');
    },
  });

  const handleMarkComplete = () => {
    if (rating === 0) {
      toast.error('Please provide a rating');
      return;
    }
    if (isSuccessful === null) {
      toast.error('Please select if the trial was successful or failed');
      return;
    }
    completeMutation.mutate();
  };

  const handleStarClick = (value: number) => {
    setRating(value);
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      DRAFT: 'secondary',
      IN_PROGRESS: 'default',
      COMPLETED: 'outline',
    };
    return variants[status] || 'secondary';
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div>
              <div className="flex items-center gap-3">
                <DialogTitle>Trial Details</DialogTitle>
                {trial && trial.status && (
                  <Badge variant={getStatusVariant(trial.status)}>
                    {trial.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>
              {trial && (
                <DialogDescription>
                  {trial.farmer?.name} - {trial.crop}
                </DialogDescription>
              )}
            </div>
            {trial && trial.status === 'IN_PROGRESS' && (
              <Button onClick={() => setShowCompleteDialog(true)} size="sm" className="shrink-0">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Complete
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : trial ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="applications">Applications</TabsTrigger>
                <TabsTrigger value="photos">Photos</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <User className="h-4 w-4 mr-2" />
                      Farmer
                    </div>
                    <p className="font-medium">{trial.farmer?.name || '-'}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Package className="h-4 w-4 mr-2" />
                      Product
                    </div>
                    <p className="font-medium">{trial.product?.name || '-'}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Crop</p>
                    <p className="font-medium">{trial.crop}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-2" />
                      Village
                    </div>
                    <p className="font-medium">{trial.village}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      Start Date
                    </div>
                    <p className="font-medium">
                      {trial.start_date ? format(new Date(trial.start_date), 'MMM dd, yyyy') : '-'}
                    </p>
                  </div>

                  {trial.season && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Season</p>
                      <p className="font-medium">{trial.season}</p>
                    </div>
                  )}
                </div>

                {(trial.rating || trial.is_successful !== null) && trial.status === 'COMPLETED' && (
                  <>
                    <Separator />
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Trial Results</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {trial.rating && (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Rating</p>
                            <div className="flex items-center gap-2">
                              {[1, 2, 3, 4, 5].map((starIndex) => {
                                const fullStars = Math.floor(trial.rating);
                                const hasHalfStar = trial.rating % 1 !== 0;
                                const halfStarIndex = Math.ceil(trial.rating);

                                const isFilled = starIndex <= fullStars;
                                const isHalfFilled = hasHalfStar && starIndex === halfStarIndex;

                                return (
                                  <div
                                    key={starIndex}
                                    className="relative inline-block w-6 h-6"
                                  >
                                    {/* Gray background star */}
                                    <Star className="absolute inset-0 w-6 h-6 text-gray-300" />

                                    {/* Full yellow star */}
                                    {isFilled && (
                                      <Star className="absolute inset-0 w-6 h-6 fill-yellow-400 text-yellow-400" />
                                    )}

                                    {/* Half yellow star */}
                                    {isHalfFilled && !isFilled && (
                                      <div className="absolute inset-0 overflow-hidden w-3">
                                        <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              <span className="ml-2 text-lg font-semibold">
                                {trial.rating.toFixed(1)} / 5.0
                              </span>
                            </div>
                          </div>
                        )}
                        {trial.is_successful !== null && (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Trial Outcome</p>
                            <Badge
                              variant={trial.is_successful ? 'default' : 'destructive'}
                              className="text-sm px-3 py-1"
                            >
                              {trial.is_successful ? '✓ Successful - Trial achieved desired results' : '✗ Failed - Trial did not meet expectations'}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}

                {trial.gps_lat && trial.gps_lng && (
                  <>
                    <Separator />
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">GPS Location</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <p className="text-sm">
                          Latitude: <span className="font-mono">{trial.gps_lat}</span>
                        </p>
                        <p className="text-sm">
                          Longitude: <span className="font-mono">{trial.gps_lng}</span>
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}

                {trial.with_other_products && (
                  <>
                    <Separator />
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Used with Other Products</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{trial.with_other_products}</p>
                      </CardContent>
                    </Card>
                  </>
                )}

                {trial.yield_value && (
                  <>
                    <Separator />
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Yield</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-600">
                          {trial.yield_value} {trial.yield_unit || 'units'}
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}

                {trial.comments && (
                  <>
                    <Separator />
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Final Comments</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{trial.comments}</p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              <TabsContent value="applications" className="space-y-4 mt-4">
                {trial.applications && trial.applications.length > 0 ? (
                  trial.applications.map((app) => (
                    <Card key={app.id}>
                      <CardHeader>
                        <CardTitle className="text-base">Application #{app.app_number}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span>{app.app_type}</span>
                          {app.app_date && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(app.app_date), 'MMM dd, yyyy')}
                              </span>
                            </>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Dosage and Batch Info */}
                        {(app.quantity_used || app.batch) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {app.quantity_used && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                  Dosage / Quantity Used
                                </p>
                                <p className="text-lg font-semibold text-foreground">
                                  {app.quantity_used} {app.batch?.unit || ''}
                                </p>
                              </div>
                            )}
                            {app.batch && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                  Batch Number
                                </p>
                                <p className="text-lg font-semibold text-foreground">
                                  {app.batch.batch_number}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Before Comments */}
                        {app.before_comments && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1 w-1 rounded-full bg-amber-500" />
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                                Before Application (Untreated)
                              </p>
                            </div>
                            <p className="text-sm text-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                              {app.before_comments}
                            </p>
                          </div>
                        )}

                        {/* After Comments */}
                        {app.after_comments && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1 w-1 rounded-full bg-green-500" />
                              <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">
                                After Application (Treated)
                              </p>
                            </div>
                            <p className="text-sm text-foreground bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                              {app.after_comments}
                            </p>
                          </div>
                        )}

                        {/* Photos Info */}
                        {app.photos && app.photos.length > 0 && (
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              {app.photos.length} photo(s) uploaded
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No applications added yet
                  </div>
                )}
              </TabsContent>

              <TabsContent value="photos" className="space-y-6 mt-4">
                {trial.applications &&
                trial.applications.some((app) => app.photos && app.photos.length > 0) ? (
                  trial.applications.map((app) =>
                    app.photos && app.photos.length > 0 ? (
                      <Card key={app.id}>
                        <CardHeader>
                          <CardTitle className="text-base">
                            Application #{app.app_number} - {app.app_type}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {app.photos.filter((p) => p.stage === 'BEFORE_UNTREATED').length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-3">Before (Untreated)</h4>
                              <div className="grid grid-cols-3 gap-4">
                                {app.photos
                                  .filter((p) => p.stage === 'BEFORE_UNTREATED')
                                  .map((photo) => {
                                    const fileUrl = getImageUrl(photo.file_url);
                                    const isVideo = isVideoFile(fileUrl);

                                    return (
                                      <div key={photo.id} className="relative group">
                                        {isVideo ? (
                                          <video
                                            src={fileUrl}
                                            className="w-full h-48 object-cover rounded-lg border"
                                            controls
                                          />
                                        ) : (
                                          <img
                                            src={fileUrl}
                                            alt="Before"
                                            className="w-full h-48 object-cover rounded-lg border"
                                          />
                                        )}
                                        {photo.gps_lat && photo.gps_lng && (
                                          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                            GPS: {photo.gps_lat.toFixed(4)}, {photo.gps_lng.toFixed(4)}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}

                          {app.photos.filter((p) => p.stage === 'AFTER_TREATED').length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-3">After (Treated)</h4>
                              <div className="grid grid-cols-3 gap-4">
                                {app.photos
                                  .filter((p) => p.stage === 'AFTER_TREATED')
                                  .map((photo) => {
                                    const fileUrl = getImageUrl(photo.file_url);
                                    const isVideo = isVideoFile(fileUrl);

                                    return (
                                      <div key={photo.id} className="relative group">
                                        {isVideo ? (
                                          <video
                                            src={fileUrl}
                                            className="w-full h-48 object-cover rounded-lg border"
                                            controls
                                          />
                                        ) : (
                                          <img
                                            src={fileUrl}
                                            alt="After"
                                            className="w-full h-48 object-cover rounded-lg border"
                                          />
                                        )}
                                        {photo.gps_lat && photo.gps_lng && (
                                          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                            GPS: {photo.gps_lat.toFixed(4)}, {photo.gps_lng.toFixed(4)}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : null
                  )
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No photos uploaded yet
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Trial not found</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Complete Trial Dialog */}
    <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Trial as Complete</DialogTitle>
          <DialogDescription>
            Please rate the trial and indicate if it was successful
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Star Rating */}
          <div className="space-y-2">
            <Label>Rating *</Label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((starIndex) => {
                const currentRating = hoveredRating || rating;
                const fullStars = Math.floor(currentRating);
                const hasHalfStar = currentRating % 1 !== 0;
                const halfStarIndex = Math.ceil(currentRating);

                const isFilled = starIndex <= fullStars;
                const isHalfFilled = hasHalfStar && starIndex === halfStarIndex;

                return (
                  <div
                    key={starIndex}
                    className="relative inline-block w-10 h-10"
                  >
                    {/* Gray background star */}
                    <Star className="absolute inset-0 w-10 h-10 text-gray-300" />

                    {/* Full yellow star */}
                    {isFilled && (
                      <Star className="absolute inset-0 w-10 h-10 fill-yellow-400 text-yellow-400" />
                    )}

                    {/* Half yellow star */}
                    {isHalfFilled && !isFilled && (
                      <div className="absolute inset-0 overflow-hidden w-5">
                        <Star className="w-10 h-10 fill-yellow-400 text-yellow-400" />
                      </div>
                    )}

                    {/* Left half button (0.5) */}
                    <button
                      type="button"
                      className="absolute left-0 top-0 w-5 h-10 cursor-pointer z-10"
                      onMouseEnter={() => setHoveredRating(starIndex - 0.5)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => setRating(starIndex - 0.5)}
                      aria-label={`Rate ${starIndex - 0.5} stars`}
                    />

                    {/* Right half button (full) */}
                    <button
                      type="button"
                      className="absolute right-0 top-0 w-5 h-10 cursor-pointer z-10"
                      onMouseEnter={() => setHoveredRating(starIndex)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => setRating(starIndex)}
                      aria-label={`Rate ${starIndex} stars`}
                    />
                  </div>
                );
              })}
              <span className="ml-2 text-sm text-muted-foreground font-medium">
                {rating > 0 ? `${rating} / 5` : 'Click to rate'}
              </span>
            </div>
          </div>

          {/* Success/Failure Selection */}
          <div className="space-y-2">
            <Label>Trial Result *</Label>
            <Select
              value={isSuccessful === null ? '' : isSuccessful ? 'successful' : 'failed'}
              onValueChange={(value) => setIsSuccessful(value === 'successful' ? true : false)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trial result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="successful">Successful - Trial achieved desired results</SelectItem>
                <SelectItem value="failed">Failed - Trial did not meet expectations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Final Comments */}
          <div className="space-y-2">
            <Label htmlFor="final-comments">Final Comments (Optional)</Label>
            <Textarea
              id="final-comments"
              placeholder="Enter any final observations, results, or conclusions..."
              value={finalComments}
              onChange={(e) => setFinalComments(e.target.value)}
              rows={4}
            />
            {trial?.comments && !finalComments && (
              <p className="text-sm text-muted-foreground">
                Current comments: {trial.comments}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleMarkComplete} disabled={completeMutation.isPending}>
            {completeMutation.isPending ? 'Completing...' : 'Complete Trial'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
