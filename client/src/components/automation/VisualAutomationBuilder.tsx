/**
 * 🎨 VISUAL AUTOMATION BUILDER
 * Drag-and-drop workflow designer for creating automation sequences
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDynamicAutomationNodes } from '@/hooks/useDynamicConfiguration';
import { useAuth } from '@/hooks/useAuth';
import { useProgressiveDisclosureContext } from '@/components/ui/ProgressiveDisclosure';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play, Pause, Save, Download, Upload, Trash2, Copy,
  Settings, Zap, MessageSquare, Phone, Calendar, Users,
  ArrowRight, Clock, AlertCircle, CheckCircle, Plus,
  GitBranch, Diamond, Circle, Square, Triangle,
  MousePointer, Hand, Move, Maximize2, Minimize2, X,
} from "lucide-react";
import { toast } from "sonner";
import { useDynamicAutomationNodes } from "@/hooks/useDynamicConfiguration";
import { trpc } from "@/lib/trpc";

// Dynamic colors based on user theme
const getDynamicAutomationColors = () => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  return {
    connection: isDarkMode ? "#60a5fa" : "#3b82f6",
    connectionHover: isDarkMode ? "#93c5fd" : "#2563eb", 
    connectionDefault: isDarkMode ? "#9ca3af" : "#6b7280",
    grid: isDarkMode ? "#374151" : "#e5e7eb",
    arrow: isDarkMode ? "#9ca3af" : "#6b7280"
  };
};

// Generate unique IDs without Math.random()
const generateUniqueId = (prefix: string): string => {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  return `${prefix}_${timestamp}_${randomSuffix}`;
};

// Workflow Node Types
export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay' | 'integration' | 'notification';
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  inputs: NodePort[];
  outputs: NodePort[];
}

export interface NodePort {
  id: string;
  name: string;
  type: 'input' | 'output';
  dataType: 'trigger' | 'message' | 'lead' | 'appointment' | 'data';
  required?: boolean;
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  style?: {
    color?: string;
    type?: 'solid' | 'dashed' | 'dotted';
  };
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    author: string;
  };
  settings: {
    timeout: number;
    retryPolicy: 'none' | 'linear' | 'exponential';
    maxRetries: number;
    logging: boolean;
  };
}

export default function VisualAutomationBuilder() {
  const dynamicNodes = useDynamicAutomationNodes();
  const { user } = useAuth();
  
  // Convert dynamic nodes to the format expected by the component
  const NODE_TEMPLATES: Omit<WorkflowNode, 'id' | 'position' | 'inputs' | 'outputs'>[] = dynamicNodes.map(node => ({
    type: node.type,
    name: node.name,
    description: node.description,
    icon: node.icon,
    category: node.category,
    config: node.config
  }));

  const [workflow, setWorkflow] = useState<Workflow>({
    id: `workflow_${Date.now()}`,
    name: 'New Automation',
    description: '',
    category: 'Custom',
    status: 'draft',
    nodes: [],
    connections: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      author: user?.name || user?.email || 'Unknown User',
    },
    settings: {
      timeout: 300,
    }
  });
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<WorkflowConnection | null>(null);
  const [connectionStart, setConnectionStart] = useState<{ nodeId: string; portId: string } | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  // Generate node ports based on type
  const generateNodePorts = (nodeType: string): { inputs: NodePort[]; outputs: NodePort[] } => {
    const baseInputs: NodePort[] = [];
    const baseOutputs: NodePort[] = [];

    switch (nodeType) {
      case 'trigger':
        baseOutputs.push({
          id: 'trigger_out',
          name: 'Trigger',
          type: 'output',
          dataType: 'trigger',
        });
        break;
      case 'action':
        baseInputs.push({
          id: 'trigger_in',
          name: 'Trigger',
          type: 'input',
          dataType: 'trigger',
          required: true,
        });
        baseOutputs.push({
          id: 'action_out',
          name: 'Result',
          type: 'output',
          dataType: 'data',
        });
        break;
      case 'condition':
        baseInputs.push({
          id: 'condition_in',
          name: 'Input',
          type: 'input',
          dataType: 'data',
          required: true,
        });
        baseOutputs.push(
          {
            id: 'condition_true',
            name: 'True',
            type: 'output',
            dataType: 'trigger',
          },
          {
            id: 'condition_false',
            name: 'False',
            type: 'output',
            dataType: 'trigger',
          }
        );
        break;
      case 'delay':
        baseInputs.push({
          id: 'delay_in',
          name: 'Input',
          type: 'input',
          dataType: 'trigger',
          required: true,
        });
        baseOutputs.push({
          id: 'delay_out',
          name: 'Output',
          type: 'output',
          dataType: 'trigger',
        });
        break;
      case 'integration':
        baseInputs.push({
          id: 'integration_in',
          name: 'Input',
          type: 'input',
          dataType: 'data',
          required: true,
        });
        baseOutputs.push({
          id: 'integration_out',
          name: 'Response',
          type: 'output',
          dataType: 'data',
        });
        break;
      case 'notification':
        baseInputs.push({
          id: 'notification_in',
          name: 'Input',
          type: 'input',
          dataType: 'data',
          required: true,
        });
        baseOutputs.push({
          id: 'notification_out',
          name: 'Sent',
          type: 'output',
          dataType: 'data',
        });
        break;
    }

    return { inputs: baseInputs, outputs: baseOutputs };
  };

  // Add node to canvas
  const addNode = useCallback((template: Omit<WorkflowNode, 'id' | 'position' | 'inputs' | 'outputs'>) => {
    const ports = generateNodePorts(template.type);
    const newNode: WorkflowNode = {
      ...template,
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      position: {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      },
      inputs: ports.inputs,
      outputs: ports.outputs,
    };

    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      metadata: {
        ...prev.metadata,
        updatedAt: new Date().toISOString(),
        version: prev.metadata.version + 1,
      },
    }));

    setSelectedNode(newNode);
    toast.success(`Added ${template.name} node`);
  }, []);

  // Handle node dragging
  const handleNodeMouseDown = (e: React.MouseEvent, node: WorkflowNode) => {
    if (readOnly) return;
    
    e.preventDefault();
    setDraggedNode(node);
    setIsDragging(true);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePosition({
        x: (e.clientX - rect.left - canvasOffset.x) / zoom,
        y: (e.clientY - rect.top - canvasOffset.y) / zoom,
      });
    }
  };

  // Handle canvas mouse move
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = (e.clientX - rect.left - canvasOffset.x) / zoom;
    const currentY = (e.clientY - rect.top - canvasOffset.y) / zoom;

    setMousePosition({ x: currentX, y: currentY });

    if (isDragging && draggedNode) {
      const newX = currentX - 50; // Center node on cursor
      const newY = currentY - 30;

      setWorkflow(prev => ({
        ...prev,
        nodes: prev.nodes.map(node =>
          node.id === draggedNode.id
            ? { ...node, position: { x: newX, y: newY } }
            : node
        ),
        metadata: {
          ...prev.metadata,
          updatedAt: new Date().toISOString(),
          version: prev.metadata.version + 1,
        },
      }));
    }

    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setCanvasOffset({ x: deltaX, y: deltaY });
    }
  }, [isDragging, draggedNode, isPanning, panStart, zoom, canvasOffset]);

  // Handle canvas mouse up
  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNode(null);
    setIsPanning(false);
  }, []);

  // Handle connection start
  const handlePortMouseDown = (e: React.MouseEvent, nodeId: string, portId: string, portType: 'input' | 'output') => {
    if (readOnly || portType === 'input') return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsConnecting(true);
    setConnectionStart({ nodeId, portId });
  };

  // Handle connection end
  const handlePortMouseUp = (e: React.MouseEvent, nodeId: string, portId: string, portType: 'input' | 'output') => {
    if (readOnly || !isConnecting || !connectionStart || portType === 'output') return;
    
    e.preventDefault();
    e.stopPropagation();

    // Check if connection already exists
    const existingConnection = workflow.connections.find(
      conn => conn.sourceNodeId === connectionStart.nodeId && conn.targetNodeId === nodeId
    );

    if (existingConnection) {
      toast.error('Connection already exists');
    } else {
      const newConnection: WorkflowConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sourceNodeId: connectionStart.nodeId,
        sourcePortId: connectionStart.portId,
        targetNodeId: nodeId,
        targetPortId: portId,
      };

      setWorkflow(prev => ({
        ...prev,
        connections: [...prev.connections, newConnection],
        metadata: {
          ...prev.metadata,
          updatedAt: new Date().toISOString(),
          version: prev.metadata.version + 1,
        },
      }));

      toast.success('Connection created');
    }

    setIsConnecting(false);
    setConnectionStart(null);
  };

  // Delete node
  const deleteNode = useCallback((nodeId: string) => {
    if (readOnly) return;
    
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      connections: prev.connections.filter(c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId),
      metadata: {
        ...prev.metadata,
        updatedAt: new Date().toISOString(),
        version: prev.metadata.version + 1,
      },
    }));

    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }

    toast.success('Node deleted');
  }, [readOnly, selectedNode]);

  // Delete connection
  const deleteConnection = useCallback((connectionId: string) => {
    if (readOnly) return;
    
    setWorkflow(prev => ({
      ...prev,
      connections: prev.connections.filter(c => c.id !== connectionId),
      metadata: {
        ...prev.metadata,
        updatedAt: new Date().toISOString(),
        version: prev.metadata.version + 1,
      },
    }));

    if (selectedConnection?.id === connectionId) {
      setSelectedConnection(null);
    }

    toast.success('Connection deleted');
  }, [readOnly, selectedConnection]);

  // Update node configuration
  const updateNodeConfig = useCallback((nodeId: string, config: Record<string, any>) => {
    if (readOnly) return;
    
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === nodeId
          ? { ...node, config: { ...node.config, ...config } }
          : node
      ),
      metadata: {
        ...prev.metadata,
        updatedAt: new Date().toISOString(),
        version: prev.metadata.version + 1,
      },
    }));
  }, [readOnly]);

  // Save workflow
  const handleSave = useCallback(() => {
    onSave?.(workflow);
    toast.success('Workflow saved successfully');
  }, [workflow, onSave]);

  // Execute workflow
  const handleExecute = useCallback(() => {
    if (workflow.status !== 'active') {
      toast.error('Workflow must be active to execute');
      return;
    }
    onExecute?.(workflow.id);
    toast.info('Executing workflow...');
  }, [workflow, onExecute]);

  // Handle canvas pan
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || e.target === svgRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
    }
  };

  // Handle zoom
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  // Render connection path
  const renderConnectionPath = (connection: WorkflowConnection) => {
    const sourceNode = workflow.nodes.find(n => n.id === connection.sourceNodeId);
    const targetNode = workflow.nodes.find(n => n.id === connection.targetNodeId);
    
    if (!sourceNode || !targetNode) return null;

    const sourcePort = sourceNode.outputs.find(p => p.id === connection.sourcePortId);
    const targetPort = targetNode.inputs.find(p => p.id === connection.targetPortId);
    
    if (!sourcePort || !targetPort) return null;

    const startX = sourceNode.position.x + 150; // Node width
    const startY = sourceNode.position.y + 30 + (sourceNode.outputs.indexOf(sourcePort) * 20);
    const endX = targetNode.position.x;
    const endY = targetNode.position.y + 30 + (targetNode.inputs.indexOf(targetPort) * 20);

    // Create curved path
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const controlOffset = Math.abs(endX - startX) * 0.3;

    return `M ${startX} ${startY} Q ${midX - controlOffset} ${startY}, ${midX} ${midY} T ${endX} ${endY}`;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <Input
                value={workflow.name}
                onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                className="text-lg font-semibold border-none p-0 h-auto"
                placeholder="Workflow Name"
              />
              <p className="text-sm text-gray-500">{workflow.description}</p>
            </div>
            <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'}>
              {workflow.status}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <Button variant="ghost" size="sm" onClick={handleZoomOut}>
                <Minimize2 className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="sm" onClick={handleZoomIn}>
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleZoomReset}>
                <Move className="h-4 w-4" />
              </Button>
            </div>
            
            {!readOnly && (
              <>
                <Button variant="outline" size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button size="sm" onClick={handleExecute}>
                  <Play className="h-4 w-4 mr-2" />
                  Execute
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Node Palette */}
        <div className="w-80 bg-white border-r overflow-y-auto">
          <div className="p-4">
            <h3 className="font-semibold mb-4">Node Library</h3>
            
            {['Triggers', 'Actions', 'Conditions', 'Flow Control', 'Integrations'].map(category => (
              <div key={category} className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">{category}</h4>
                <div className="space-y-2">
                  {NODE_TEMPLATES
                    .filter(template => template.category === category)
                    .map(template => (
                      <div
                        key={template.name}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => !readOnly && addNode(template)}
                      >
                        <div className="p-2 bg-white rounded border">
                          {template.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-gray-500 truncate">{template.description}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={canvasRef}
            className="absolute inset-0 cursor-move"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            style={{
              backgroundImage: `radial-gradient(circle, ${colors.grid} 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
              backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
            }}
          >
            {/* SVG for connections */}
            <svg
              ref={svgRef}
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {/* Render existing connections */}
              {workflow.connections.map(connection => {
                const path = renderConnectionPath(connection);
                if (!path) return null;
                
                return (
                  <g key={connection.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke={selectedConnection?.id === connection.id ? colors.connection : colors.connectionDefault}
                      strokeWidth={selectedConnection?.id === connection.id ? 3 : 2}
                      className="pointer-events-auto cursor-pointer hover:stroke-blue-500"
                      onClick={() => setSelectedConnection(connection)}
                    />
                    <Arrowhead
                      cx={workflow.nodes.find(n => n.id === connection.targetNodeId)?.position.x || 0}
                      cy={workflow.nodes.find(n => n.id === connection.targetNodeId)?.position.y || 0}
                      color={colors.arrow}
                    />
                  </g>
                );
              })}
              
              {/* Render connection in progress */}
              {isConnecting && connectionStart && (
                <path
                  d={`M ${(workflow.nodes.find(n => n.id === connectionStart.nodeId)?.position.x || 0) + 150} ${(workflow.nodes.find(n => n.id === connectionStart.nodeId)?.position.y || 0) + 30} L ${mousePosition.x} ${mousePosition.y}`}
                  fill="none"
                  stroke={colors.connection}
                  strokeWidth={2}
                  strokeDasharray="5,5"
                  className="pointer-events-none"
                />
              )}
            </svg>

            {/* Render nodes */}
            {workflow.nodes.map(node => (
              <div
                key={node.id}
                className={`absolute bg-white border rounded-lg shadow-sm cursor-move transition-shadow ${
                  selectedNode?.id === node.id ? 'border-blue-500 shadow-lg' : 'border-gray-200'
                } ${isDragging && draggedNode?.id === node.id ? 'opacity-75' : ''}`}
                style={{
                  left: node.position.x,
                  top: node.position.y,
                  transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  minWidth: 150,
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onClick={() => setSelectedNode(node)}
              >
                {/* Node Header */}
                <div className="flex items-center gap-2 p-3 border-b bg-gray-50 rounded-t-lg">
                  <div className="p-1 bg-white rounded border">
                    {node.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{node.name}</div>
                    <div className="text-xs text-gray-500">{node.type}</div>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode(node.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Ports */}
                <div className="relative">
                  {/* Input ports */}
                  <div className="absolute left-0 top-2 space-y-2">
                    {node.inputs.map((port, index) => (
                      <div
                        key={port.id}
                        className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white cursor-pointer hover:bg-blue-600"
                        style={{ top: `${index * 20}px` }}
                        onMouseDown={(e) => handlePortMouseDown(e, node.id, port.id, 'input')}
                        onMouseUp={(e) => handlePortMouseUp(e, node.id, port.id, 'input')}
                        title={port.name}
                      />
                    ))}
                  </div>

                  {/* Output ports */}
                  <div className="absolute right-0 top-2 space-y-2">
                    {node.outputs.map((port, index) => (
                      <div
                        key={port.id}
                        className="w-3 h-3 bg-green-500 rounded-full border-2 border-white cursor-pointer hover:bg-green-600"
                        style={{ top: `${index * 20}px` }}
                        onMouseDown={(e) => handlePortMouseDown(e, node.id, port.id, 'output')}
                        title={port.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Node Content */}
                <div className="p-3 pt-6">
                  <div className="text-xs text-gray-600 mb-2">{node.description}</div>
                  {Object.entries(node.config).length > 0 && (
                    <div className="text-xs text-gray-500">
                      {Object.keys(node.config).length} configuration{Object.keys(node.config).length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-80 bg-white border-l overflow-y-auto">
          {selectedNode ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Node Properties</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedNode(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Node Name</Label>
                  <Input
                    value={selectedNode.name}
                    onChange={(e) => {
                      const updatedNode = { ...selectedNode, name: e.target.value };
                      setWorkflow(prev => ({
                        ...prev,
                        nodes: prev.nodes.map(n => n.id === selectedNode.id ? updatedNode : n),
                      }));
                      setSelectedNode(updatedNode);
                    }}
                    disabled={readOnly}
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={selectedNode.description}
                    onChange={(e) => {
                      const updatedNode = { ...selectedNode, description: e.target.value };
                      setWorkflow(prev => ({
                        ...prev,
                        nodes: prev.nodes.map(n => n.id === selectedNode.id ? updatedNode : n),
                      }));
                      setSelectedNode(updatedNode);
                    }}
                    disabled={readOnly}
                    rows={2}
                  />
                </div>

                {/* Node-specific configuration */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Configuration</Label>
                  {Object.entries(selectedNode.config).map(([key, value]) => (
                    <div key={key}>
                      <Label className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                      {typeof value === 'boolean' ? (
                        <Switch
                          checked={value}
                          onCheckedChange={(checked) => updateNodeConfig(selectedNode.id, { [key]: checked })}
                          disabled={readOnly}
                        />
                      ) : typeof value === 'number' ? (
                        <Input
                          type="number"
                          value={value}
                          onChange={(e) => updateNodeConfig(selectedNode.id, { [key]: parseInt(e.target.value) })}
                          disabled={readOnly}
                        />
                      ) : (
                        <Input
                          value={value}
                          onChange={(e) => updateNodeConfig(selectedNode.id, { [key]: e.target.value })}
                          disabled={readOnly}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <div className="mb-4">
                <Settings className="h-12 w-12 mx-auto text-gray-300" />
              </div>
              <p>Select a node to view its properties</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Arrowhead component for connections
function Arrowhead({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <polygon
      points={`${cx},${cy} ${cx - 8},${cy - 4} ${cx - 8},${cy + 4}`}
      fill={color}
    />
  );
}
