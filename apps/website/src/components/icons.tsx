import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";
import {
  Alert02Icon as Alert02IconData,
  AlertCircleIcon as AlertCircleIconData,
  ArchiveIcon as ArchiveIconData,
  ArchiveRestoreIcon as ArchiveRestoreIconData,
  ArrowDownIcon as ArrowDownIconData,
  ArrowLeft as ArrowLeftData,
  ArrowLeftIcon as ArrowLeftIconData,
  ArrowRight as ArrowRightData,
  ArrowRightIcon as ArrowRightIconData,
  ArrowUpIcon as ArrowUpIconData,
  ArrowUpRight as ArrowUpRightData,
  ArrowUpRightIcon as ArrowUpRightIconData,
  BookOpenCheckIcon as BookOpenCheckIconData,
  BookOpenIcon as BookOpenIconData,
  BrainIcon as BrainIconData,
  CalendarClockIcon as CalendarClockIconData,
  CalendarDaysIcon as CalendarDaysIconData,
  CalendarPlusIcon as CalendarPlusIconData,
  CalendarXIcon as CalendarXIconData,
  Layers01Icon as FlashcardsData,
  ChartColumnIcon as ChartColumnIconData,
  ChartNoAxesColumnIncreasingIcon as ChartNoAxesColumnIncreasingIconData,
  CheckIcon as CheckIconData,
  ChevronDown as ChevronDownData,
  ChevronDownIcon as ChevronDownIconData,
  ChevronLeftIcon as ChevronLeftIconData,
  ChevronRightIcon as ChevronRightIconData,
  ChevronUpIcon as ChevronUpIconData,
  CircleCheckIcon as CircleCheckIconData,
  CircleIcon as CircleIconData,
  CircleXIcon as CircleXIconData,
  ClockAlertIcon as ClockAlertIconData,
  CloudCheckIcon as CloudCheckIconData,
  CloudUploadIcon as CloudUploadIconData,
  CoinsIcon as CoinsIconData,
  CopyIcon as CopyIconData,
  CreditCardIcon as CreditCardIconData,
  CrownIcon as CrownIconData,
  DatabaseIcon as DatabaseIconData,
  Delete02Icon as Delete02IconData,
  DownloadIcon as DownloadIconData,
  EllipsisIcon as EllipsisIconData,
  EyeIcon as EyeIconData,
  EyeOffIcon as EyeOffIconData,
  FileAddIcon as FileAddIconData,
  FileSpreadsheetIcon as FileSpreadsheetIconData,
  FileText as FileTextData,
  FileTextIcon as FileTextIconData,
  FilesIcon as FilesIconData,
  FilterIcon as FilterIconData,
  FolderIcon as FolderIconData,
  FolderOpen as FolderOpenData,
  FolderOpenIcon as FolderOpenIconData,
  FolderPlusIcon as FolderPlusIconData,
  FolderXIcon as FolderXIconData,
  GraduationCapIcon as GraduationCapIconData,
  Grid2X2Icon as Grid2X2IconData,
  GridViewIcon as GridViewIconData,
  HardDriveIcon as HardDriveIconData,
  HeartIcon as HeartIconData,
  HelpCircleIcon as HelpCircleIconData,
  HistoryIcon as HistoryIconData,
  Home03Icon as HomeIconData,
  Home03Icon as HouseIconData,
  ImageIcon as ImageIconData,
  ImageNotFound01Icon as ImageNotFound01IconData,
  InfoIcon as InfoIconData,
  LayersIcon as LayersIconData,
  LinkIcon as LinkIconData,
  ListChecksIcon as ListChecksIconData,
  ListFilterIcon as ListFilterIconData,
  ListIcon as ListIconData,
  ListOrderedIcon as ListOrderedIconData,
  ListViewIcon as ListViewIconData,
  LoaderCircleIcon as LoaderCircleIconData,
  Loading03Icon as Loading03IconData,
  LogOutIcon as LogOutIconData,
  MagicWandIcon as MagicWandIconData,
  Mail01Icon as Mail01IconData,
  MailOpen01Icon as MailOpen01IconData,
  MedalIcon as MedalIconData,
  Minus as MinusData,
  MinusIcon as MinusIconData,
  MonitorIcon as MonitorIconData,
  MoonIcon as MoonIconData,
  MoreHorizontalIcon as MoreHorizontalIconData,
  MoveRightIcon as MoveRightIconData,
  OctagonXIcon as OctagonXIconData,
  PaletteIcon as PaletteIconData,
  PanelLeftOpenIcon as PanelLeftCloseIconData,
  PanelLeftIcon as PanelLeftIconData,
  PanelLeftCloseIcon as PanelLeftOpenIconData,
  PencilEdit01Icon as PencilEdit01IconData,
  PencilIcon as PencilIconData,
  PlayIcon as PlayIconData,
  Plus as PlusData,
  PlusIcon as PlusIconData,
  Printer as PrinterData,
  CheckListIcon as QuizData,
  RefreshCwIcon as RefreshCwIconData,
  ReloadIcon as ReloadIconData,
  RepeatIcon as RepeatIconData,
  ReplaceIcon as ReplaceIconData,
  SearchIcon as SearchIconData,
  SearchXIcon as SearchXIconData,
  SettingsIcon as SettingsIconData,
  ShieldCheckIcon as ShieldCheckIconData,
  SlidersHorizontalIcon as SlidersHorizontalIconData,
  Sorting01Icon as Sorting01IconData,
  SparklesIcon as SparklesIconData,
  SquareCheckBigIcon as SquareCheckBigIconData,
  SquareUnlock01Icon as SquareUnlock01IconData,
  SunIcon as SunIconData,
  TextQuoteIcon as TextQuoteIconData,
  TrashIcon as TrashIconData,
  TriangleAlertIcon as TriangleAlertIconData,
  TrophyIcon as TrophyIconData,
  UploadIcon as UploadIconData,
  UserCircleIcon as UserCircleIconData,
  X as XData,
  XCircle as XCircleData,
  XIcon as XIconData,
  Diamond02Icon as Diamond02IconData,
} from "@hugeicons/core-free-icons";

export type IconProps = Omit<HugeiconsIconProps, "icon" | "strokeWidth"> & {
  strokeWidth?: string | number;
};
export type AppIcon = React.ComponentType<IconProps>;

/** Static free Stroke Rounded glyphs. One optical weight, native SVG refs and labels. */
export const createIcon = (icon: HugeiconsIconProps["icon"]): AppIcon =>
  function Icon({ size = 20, strokeWidth = 1.65, ...props }: IconProps) {
    return <HugeiconsIcon icon={icon} size={size} strokeWidth={Number(strokeWidth)} {...props} />;
  };

export const AlertTriangleIcon = createIcon(Alert02IconData);
export const ArchiveIcon = createIcon(ArchiveIconData);
export const ArchiveRestoreIcon = createIcon(ArchiveRestoreIconData);
export const ArrowClockwiseIcon = createIcon(ReloadIconData);
export const GemIcon = createIcon(Diamond02IconData);
export const ArrowDownIcon = createIcon(ArrowDownIconData);
export const ArrowLeft = createIcon(ArrowLeftData);
export const ArrowLeftIcon = createIcon(ArrowLeftIconData);
export const ArrowRight = createIcon(ArrowRightData);
export const ArrowRightIcon = createIcon(ArrowRightIconData);
export const ArrowUpIcon = createIcon(ArrowUpIconData);
export const ArrowUpRight = createIcon(ArrowUpRightData);
export const ArrowUpRightIcon = createIcon(ArrowUpRightIconData);
export const ArticleIcon = createIcon(FileTextIconData);
export const BarChart3Icon = createIcon(ChartColumnIconData);
export const BookOpenCheckIcon = createIcon(BookOpenCheckIconData);
export const BookOpenIcon = createIcon(BookOpenIconData);
export const BrainIcon = createIcon(BrainIconData);
export const CalendarClockIcon = createIcon(CalendarClockIconData);
export const CalendarDaysIcon = createIcon(CalendarDaysIconData);
export const CalendarPlusIcon = createIcon(CalendarPlusIconData);
export const CalendarXIcon = createIcon(CalendarXIconData);
export const CardsThreeIcon = createIcon(FlashcardsData);
export const ChartBarIcon = createIcon(ChartColumnIconData);
export const ChartNoAxesColumnIncreasingIcon = createIcon(ChartNoAxesColumnIncreasingIconData);
export const CheckCircle2 = createIcon(CircleCheckIconData);
export const CheckCircleIcon = createIcon(CircleCheckIconData);
export const CheckIcon = createIcon(CheckIconData);
export const ChevronDown = createIcon(ChevronDownData);
export const ChevronDownIcon = createIcon(ChevronDownIconData);
export const ChevronLeftIcon = createIcon(ChevronLeftIconData);
export const ChevronRightIcon = createIcon(ChevronRightIconData);
export const ChevronRight = ChevronRightIcon;
export const ChevronUpIcon = createIcon(ChevronUpIconData);
export const ChevronsUpDownIcon = createIcon(ChevronDownIconData);
export const CircleAlertIcon = createIcon(AlertCircleIconData);
export const CircleCheckIcon = createIcon(CircleCheckIconData);
export const CircleIcon = createIcon(CircleIconData);
export const CircleNotchIcon = createIcon(Loading03IconData);
export const ClockAlertIcon = createIcon(ClockAlertIconData);
export const CloudCheckIcon = createIcon(CloudCheckIconData);
export const CloudUploadIcon = createIcon(CloudUploadIconData);
export const CoinsIcon = createIcon(CoinsIconData);
export const CopyIcon = createIcon(CopyIconData);
export const CreditCardIcon = createIcon(CreditCardIconData);
export const CrownIcon = createIcon(CrownIconData);
export const DatabaseIcon = createIcon(DatabaseIconData);
export const DotsThreeIcon = createIcon(MoreHorizontalIconData);
export const DownloadIcon = createIcon(DownloadIconData);
export const EllipsisIcon = createIcon(EllipsisIconData);
export const EnvelopeSimpleIcon = createIcon(Mail01IconData);
export const EnvelopeSimpleOpenIcon = createIcon(MailOpen01IconData);
export const ExamIcon = createIcon(QuizData);
export const EyeIcon = createIcon(EyeIconData);
export const EyeOffIcon = createIcon(EyeOffIconData);
export const FilePlus2Icon = createIcon(FileAddIconData);
export const FileSpreadsheetIcon = createIcon(FileSpreadsheetIconData);
export const FileText = createIcon(FileTextData);
export const FileTextIcon = createIcon(FileTextIconData);
export const FilesIcon = createIcon(FilesIconData);
export const FilterIcon = createIcon(FilterIconData);
export const FolderIcon = createIcon(FolderIconData);
export const FolderOpen = createIcon(FolderOpenData);
export const FolderOpenIcon = createIcon(FolderOpenIconData);
export const FolderPlusIcon = createIcon(FolderPlusIconData);
export const FolderXIcon = createIcon(FolderXIconData);
export const FunnelSimpleIcon = createIcon(FilterIconData);
export const GraduationCapIcon = createIcon(GraduationCapIconData);
export const Grid2X2Icon = createIcon(Grid2X2IconData);
export const GridFourIcon = createIcon(GridViewIconData);
export const HardDriveIcon = createIcon(HardDriveIconData);
export const HeartIcon = createIcon(HeartIconData);
export const HistoryIcon = createIcon(HistoryIconData);
export const HomeIcon = createIcon(HomeIconData);
export const HouseIcon = createIcon(HouseIconData);
export const ImageBrokenIcon = createIcon(ImageNotFound01IconData);
export const ImageIcon = createIcon(ImageIconData);
export const InfoIcon = createIcon(InfoIconData);
export const HelpCircleIcon = createIcon(HelpCircleIconData);
export const Layers3Icon = createIcon(LayersIconData);
export const Link2Icon = createIcon(LinkIconData);
export const LinkSimpleIcon = createIcon(LinkIconData);
export const ListBulletsIcon = createIcon(ListViewIconData);
export const ListChecksIcon = createIcon(ListChecksIconData);
export const ListFilterIcon = createIcon(ListFilterIconData);
export const ListIcon = createIcon(ListIconData);
export const ListOrderedIcon = createIcon(ListOrderedIconData);
export const Loader2Icon = createIcon(Loading03IconData);
export const LoaderCircleIcon = createIcon(LoaderCircleIconData);
export const LockKeyOpenIcon = createIcon(SquareUnlock01IconData);
export const LogOutIcon = createIcon(LogOutIconData);
export const MagicWandIcon = createIcon(MagicWandIconData);
export const MagnifyingGlassIcon = createIcon(SearchIconData);
export const MedalIcon = createIcon(MedalIconData);
export const Minus = createIcon(MinusData);
export const MinusIcon = createIcon(MinusIconData);
export const MonitorIcon = createIcon(MonitorIconData);
export const MoonIcon = createIcon(MoonIconData);
export const MoreHorizontalIcon = createIcon(MoreHorizontalIconData);
export const MoveRightIcon = createIcon(MoveRightIconData);
export const OctagonXIcon = createIcon(OctagonXIconData);
export const PaletteIcon = createIcon(PaletteIconData);
export const PanelLeftCloseIcon = createIcon(PanelLeftCloseIconData);
export const PanelLeftIcon = createIcon(PanelLeftIconData);
export const PanelLeftOpenIcon = createIcon(PanelLeftOpenIconData);
export const PencilIcon = createIcon(PencilIconData);
export const PencilSimpleIcon = createIcon(PencilEdit01IconData);
export const PlayIcon = createIcon(PlayIconData);
export const Plus = createIcon(PlusData);
export const PlusIcon = createIcon(PlusIconData);
export const Printer = createIcon(PrinterData);
export const RefreshCwIcon = createIcon(RefreshCwIconData);
export const RepeatIcon = createIcon(RepeatIconData);
export const ReplaceIcon = createIcon(ReplaceIconData);
export const RotateCcw = createIcon(ReloadIconData);
export const RotateCcwIcon = createIcon(ReloadIconData);
export const SearchIcon = createIcon(SearchIconData);
export const SearchXIcon = createIcon(SearchXIconData);
export const SettingsIcon = createIcon(SettingsIconData);
export const ShieldCheckIcon = createIcon(ShieldCheckIconData);
export const SlidersHorizontalIcon = createIcon(SlidersHorizontalIconData);
export const SortAscendingIcon = createIcon(Sorting01IconData);
export const SparklesIcon = createIcon(SparklesIconData);
export const SquareCheckBig = createIcon(SquareCheckBigIconData);
export const SquareCheckBigIcon = createIcon(SquareCheckBigIconData);
export const StackIcon = createIcon(LayersIconData);
export const SunIcon = createIcon(SunIconData);
export const TextQuoteIcon = createIcon(TextQuoteIconData);
export const Trash2Icon = createIcon(Delete02IconData);
export const TrashIcon = createIcon(TrashIconData);
export const TriangleAlertIcon = createIcon(TriangleAlertIconData);
export const TrophyIcon = createIcon(TrophyIconData);
export const UploadCloudIcon = createIcon(CloudUploadIconData);
export const UploadIcon = createIcon(UploadIconData);
export const UploadSimpleIcon = createIcon(UploadIconData);
export const UserCircleIcon = createIcon(UserCircleIconData);
export const WarningCircleIcon = createIcon(AlertCircleIconData);
export const X = createIcon(XData);
export const XCircle = createIcon(XCircleData);
export const XCircleIcon = createIcon(CircleXIconData);
export const XIcon = createIcon(XIconData);
