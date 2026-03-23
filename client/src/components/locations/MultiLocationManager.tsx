/**
 * 🏢 MULTI-LOCATION MANAGEMENT
 * Comprehensive multi-location business management
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building, MapPin, Phone, Mail, Clock, Users,
  Plus, Edit, Trash2, Copy, Move, BarChart3,
  TrendingUp, AlertCircle, CheckCircle, Settings,
  Globe, Calendar, DollarSign, MessageSquare,
  ArrowUp, ArrowDown, ArrowRight, Eye, EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface Location {
  id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  contact: {
    phone: string;
    email: string;
    website?: string;
  };
  settings: {
    timezone: string;
    businessHours: {
      [key: string]: { open: string; close: string; closed: boolean };
    };
    currency: string;
    language: string;
  };
  staff: {
    manager: string;
    employees: number;
    departments: string[];
  };
  metrics: {
    totalLeads: number;
    totalRevenue: number;
    conversionRate: number;
    averageRating: number;
    activeStaff: number;
  };
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: string;
  updatedAt: string;
}

interface MultiLocationManagerProps {
  onLocationSelect?: (location: Location) => void;
  showAnalytics?: boolean;
  allowEditing?: boolean;
}

export function MultiLocationManager({ 
  onLocationSelect, 
  showAnalytics = true, 
  allowEditing = true 
}: MultiLocationManagerProps) {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Real data from API - no simulation!
  const { data: locationsData, isLoading, error } = trpc.locations.list.useQuery();
  const createLocation = trpc.locations.create.useMutation();
  const updateLocation = trpc.locations.update.useMutation();
  const deleteLocation = trpc.locations.delete.useMutation();

  useEffect(() => {
    if (locationsData) {
      setLocations(locationsData);
      if (locationsData.length > 0 && !selectedLocation) {
        setSelectedLocation(locationsData[0]);
      }
    }
  }, [locationsData, selectedLocation]);

  const activeLocations = locations.filter(loc => 
    showInactive ? true : loc.status === 'active'
  );

  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
    onLocationSelect?.(location);
  };

  const handleCreateLocation = () => {
    setIsCreating(true);
    // TODO: Implement location creation
    toast.info("Location creation coming soon");
  };

  const handleEditLocation = (location: Location) => {
    setSelectedLocation(location);
    setIsEditing(true);
  };

  const handleDuplicateLocation = (location: Location) => {
    // TODO: Implement location duplication
    toast.info("Location duplication coming soon");
  };

  const handleDeleteLocation = (location: Location) => {
    // TODO: Implement location deletion
    toast.info("Location deletion coming soon");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'inactive': return 'text-gray-600';
      case 'maintenance': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'inactive': return <Badge variant="secondary">Inactive</Badge>;
      case 'maintenance': return <Badge className="bg-yellow-100 text-yellow-800">Maintenance</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Multi-Location Management</h1>
          <p className="text-muted-foreground">
            Manage all your business locations from one central dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <label htmlFor="show-inactive" className="text-sm">
              Show inactive
            </label>
          </div>
          {allowEditing && (
            <Button onClick={handleCreateLocation}>
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          )}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locations.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeLocations.filter(loc => loc.status === 'active').length} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {locations.reduce((sum, loc) => sum + loc.staff.employees, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all locations
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Combined Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(locations.reduce((sum, loc) => sum + loc.metrics.totalRevenue, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {locations.length > 0 
                ? Math.round(locations.reduce((sum, loc) => sum + loc.metrics.conversionRate, 0) / locations.length)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across all locations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Location List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Locations</CardTitle>
              <p className="text-sm text-muted-foreground">
                {activeLocations.length} locations
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeLocations.map((location) => (
                <div
                  key={location.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedLocation?.id === location.id
                      ? 'bg-blue-50 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleLocationSelect(location)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{location.name}</h3>
                        {getStatusBadge(location.status)}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">
                          {location.address.city}, {location.address.state}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{location.staff.employees} staff</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>{formatCurrency(location.metrics.totalRevenue)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {allowEditing && (
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditLocation(location);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateLocation(location);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {activeLocations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No locations found</p>
                  <p className="text-sm mt-1">
                    {showInactive ? 'Try adjusting filters' : 'Add your first location to get started'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Location Details */}
        <div className="lg:col-span-2">
          {selectedLocation ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="staff">Staff</TabsTrigger>
                {showAnalytics && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Location Info */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building className="h-5 w-5 text-blue-500" />
                        <div>
                          <CardTitle>{selectedLocation.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(selectedLocation.status)}
                            <Badge variant="outline" className="text-xs">
                              ID: {selectedLocation.id}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Address</Label>
                        <div className="text-sm text-gray-600 mt-1">
                          <div>{selectedLocation.address.street}</div>
                          <div>
                            {selectedLocation.address.city}, {selectedLocation.address.state} {selectedLocation.address.zip}
                          </div>
                          <div>{selectedLocation.address.country}</div>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Contact</Label>
                        <div className="text-sm text-gray-600 mt-1 space-y-1">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {selectedLocation.contact.phone}
                          </div>
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {selectedLocation.contact.email}
                          </div>
                          {selectedLocation.contact.website && (
                            <div className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {selectedLocation.contact.website}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedLocation.metrics.totalLeads}
                        </div>
                        <div className="text-xs text-gray-500">Total Leads</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {selectedLocation.metrics.conversionRate}%
                        </div>
                        <div className="text-xs text-gray-500">Conversion</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {selectedLocation.metrics.averageRating}
                        </div>
                        <div className="text-xs text-gray-500">Rating</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {selectedLocation.metrics.activeStaff}
                        </div>
                        <div className="text-xs text-gray-500">Active Staff</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Business Hours */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Business Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2">
                      {Object.entries(selectedLocation.settings.businessHours).map(([day, hours]) => (
                        <div key={day} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{day}</span>
                            {hours.closed && (
                              <Badge variant="secondary" className="text-xs">Closed</Badge>
                            )}
                          </div>
                          {!hours.closed && (
                            <span className="text-sm text-gray-600">
                              {hours.open} - {hours.close}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Globe className="h-4 w-4" />
                        <span>Timezone: {selectedLocation.settings.timezone}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Location Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label>Currency</Label>
                        <Select value={selectedLocation.settings.currency} disabled>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                            <SelectItem value="EUR">EUR - Euro</SelectItem>
                            <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Language</Label>
                        <Select value={selectedLocation.settings.language} disabled>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                            <SelectItem value="fr">French</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Location Status</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Control whether this location is accepting new appointments
                          </p>
                        </div>
                        <Switch
                          checked={selectedLocation.status === 'active'}
                          disabled
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Staff Tab */}
              <TabsContent value="staff" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Staff Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label>Location Manager</Label>
                        <Input value={selectedLocation.staff.manager} disabled />
                      </div>
                      
                      <div>
                        <Label>Total Employees</Label>
                        <Input type="number" value={selectedLocation.staff.employees} disabled />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Departments</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedLocation.staff.departments.map((dept, index) => (
                          <Badge key={index} variant="outline">
                            {dept}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Active Staff</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Currently active and available
                          </p>
                        </div>
                        <span className="text-2xl font-bold text-green-600">
                          {selectedLocation.metrics.activeStaff}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Tab */}
              {showAnalytics && (
                <TabsContent value="analytics" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Location Analytics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-gray-500">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>Detailed analytics coming soon</p>
                        <p className="text-sm mt-1">
                          Revenue trends, performance metrics, and comparisons
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900">Select a location</h3>
                <p className="text-gray-500 mt-2">
                  Choose a location from the list to view details and manage settings
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
