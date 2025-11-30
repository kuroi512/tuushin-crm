'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, X, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuotationTextItem {
  text_en: string;
  text_mn: string;
  text_ru: string;
  category: 'INCLUDE' | 'EXCLUDE' | 'REMARK';
}

interface QuotationTextListProps {
  title: string;
  items: QuotationTextItem[];
  onChange: (items: QuotationTextItem[]) => void;
  category: 'INCLUDE' | 'EXCLUDE' | 'REMARK';
  language?: 'en' | 'mn' | 'ru';
  className?: string;
}

export function QuotationTextList({
  title,
  items,
  onChange,
  category,
  language = 'en',
  className,
}: QuotationTextListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState<QuotationTextItem>({
    text_en: '',
    text_mn: '',
    text_ru: '',
    category,
  });

  const getDisplayText = (item: QuotationTextItem) => {
    switch (language) {
      case 'mn':
        return item.text_mn;
      case 'ru':
        return item.text_ru;
      default:
        return item.text_en;
    }
  };

  const handleAdd = () => {
    if (!newItem.text_en.trim() && !newItem.text_mn.trim() && !newItem.text_ru.trim()) {
      return;
    }
    onChange([...items, { ...newItem }]);
    setNewItem({ text_en: '', text_mn: '', text_ru: '', category });
    setShowAddModal(false);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    onChange(newItems);
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    onChange(newItems);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between border-l-4 border-yellow-400 bg-gray-50 px-4 py-2">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-8 w-8 rounded bg-green-600 p-0 hover:bg-green-700"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="h-4 w-4 text-white" />
        </Button>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-gray-500">
            No items. Click + to add.
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-md border bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-1 text-gray-400">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex-1 text-sm text-gray-900">{getDisplayText(item)}</div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 rounded bg-green-50 p-0 hover:bg-green-100"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                >
                  <ArrowUp className="h-3.5 w-3.5 text-green-600" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 rounded bg-red-50 p-0 hover:bg-red-100"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === items.length - 1}
                >
                  <ArrowDown className="h-3.5 w-3.5 text-red-600" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 rounded bg-red-50 p-0 hover:bg-red-100"
                  onClick={() => handleRemove(index)}
                >
                  <X className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>Enter the text in all three languages</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>English Text</Label>
              <Input
                value={newItem.text_en}
                onChange={(e) => setNewItem({ ...newItem, text_en: e.target.value })}
                placeholder="Enter English text..."
              />
            </div>
            <div>
              <Label>Mongolian Text</Label>
              <Input
                value={newItem.text_mn}
                onChange={(e) => setNewItem({ ...newItem, text_mn: e.target.value })}
                placeholder="Enter Mongolian text..."
              />
            </div>
            <div>
              <Label>Russian Text</Label>
              <Input
                value={newItem.text_ru}
                onChange={(e) => setNewItem({ ...newItem, text_ru: e.target.value })}
                placeholder="Enter Russian text..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
