declare module 'lucide-react' {
  import React from 'react';

  export type LucideProps = React.SVGProps<SVGSVGElement> & {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  };

  export type LucideIcon = React.FC<LucideProps>;

  export const Check: LucideIcon;
  export const X: LucideIcon;
  export const Ban: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const KeyRound: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const Search: LucideIcon;
  export const FileDown: LucideIcon;
  export const Trash2: LucideIcon;
  export const Shield: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const Clock: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const Info: LucideIcon;
  export const Edit: LucideIcon;
  export const Edit2: LucideIcon;
  export const Trash: LucideIcon;
  export const Plus: LucideIcon;
  export const Users: LucideIcon;
  export const Calendar: LucideIcon;
  export const DollarSign: LucideIcon;
  export const ShieldAlert: LucideIcon;
  export const LogOut: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const Lock: LucideIcon;
  export const Briefcase: LucideIcon;
  export const Folder: LucideIcon;
  export const SquarePen: LucideIcon;
  export const MapPin: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Bot: LucideIcon;
  export const FolderOpen: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const FolderPlus: LucideIcon;
  export const Undo: LucideIcon;
  export const FileSpreadsheet: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const User: LucideIcon;
  export const UserCheck: LucideIcon;
  export const UserX: LucideIcon;
  export const Settings: LucideIcon;
  export const HelpCircle: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const Download: LucideIcon;
  export const Upload: LucideIcon;
  export const Filter: LucideIcon;
  export const ArrowUpDown: LucideIcon;
  export const MoreVertical: LucideIcon;
  export const FileText: LucideIcon;
  export const Home: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const Activity: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const PieChart: LucideIcon;
  export const BarChart: LucideIcon;

  const defaultIcon: LucideIcon;
  export default defaultIcon;
}
