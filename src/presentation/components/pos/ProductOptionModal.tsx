import React, { useState } from 'react';
import { Product, ProductOption, ProductOptionChoice, SelectedOptionChoice } from '../../../types';
import { X, Plus, Minus, Check, Tag } from 'lucide-react';

interface ProductOptionModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: (
    product: Product,
    quantity: number,
    selectedOptions: SelectedOptionChoice[],
    itemNotes: string,
    calculatedUnitPrice: number
  ) => void;
}

export const ProductOptionModal: React.FC<ProductOptionModalProps> = ({
  product,
  onClose,
  onConfirm
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [itemNotes, setItemNotes] = useState<string>('');

  // Map optionId -> SelectedChoice
  const [selectedChoices, setSelectedChoices] = useState<Record<string, ProductOptionChoice>>(() => {
    const initial: Record<string, ProductOptionChoice> = {};
    if (product.options && product.options.length > 0) {
      product.options.forEach(opt => {
        if (opt.choices && opt.choices.length > 0) {
          const defaultChoice = opt.choices.find(c => c.isDefault) || opt.choices[0];
          initial[opt.id] = defaultChoice;
        }
      });
    }
    return initial;
  });

  const handleChoiceSelect = (option: ProductOption, choice: ProductOptionChoice) => {
    setSelectedChoices(prev => ({
      ...prev,
      [option.id]: choice
    }));
  };

  // Calculate unit price including options
  const optionsExtra = Object.values(selectedChoices).reduce((sum, choice) => sum + (choice.priceModifier || 0), 0);
  const calculatedUnitPrice = product.price + optionsExtra;
  const totalPrice = calculatedUnitPrice * quantity;

  const handleAddToCart = () => {
    const selectedOptionsList: SelectedOptionChoice[] = (product.options || []).map(opt => {
      const choice = selectedChoices[opt.id];
      return {
        optionId: opt.id,
        optionName: opt.name,
        choiceId: choice ? choice.id : '',
        choiceName: choice ? choice.name : '',
        priceModifier: choice ? choice.priceModifier : 0
      };
    }).filter(item => item.choiceId !== '');

    onConfirm(product, quantity, selectedOptionsList, itemNotes, calculatedUnitPrice);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 pb-4 border-b border-slate-800">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-16 h-16 rounded-2xl object-cover border border-slate-800"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 font-bold">
              {(product.name || 'P').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {product.category}
            </span>
            <h3 className="text-lg font-extrabold text-white mt-1">{product.name}</h3>
            <p className="text-xs text-slate-400 line-clamp-1">{product.shortDescription || product.description}</p>
            <span className="text-sm font-extrabold text-emerald-400 mt-1 block">
              Base Price: ${(product.price || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Options Selection List */}
        {product.options && product.options.length > 0 ? (
          <div className="space-y-4">
            {product.options.map(opt => (
              <div key={opt.id} className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white font-bold flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" /> {opt.name}
                    {opt.isRequired && <span className="text-rose-400 font-bold">*</span>}
                  </span>
                  <span className="text-slate-400 text-[10px]">Select one choice</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {opt.choices.map(choice => {
                    const isSelected = selectedChoices[opt.id]?.id === choice.id;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => handleChoiceSelect(opt, choice)}
                        className={`p-3 rounded-2xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-slate-700'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span>{choice.name}</span>
                        </div>
                        {(choice.priceModifier || 0) > 0 && (
                          <span className="text-[10px] text-emerald-400 font-bold">+${(choice.priceModifier || 0).toFixed(2)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-2 text-xs text-slate-400 italic">
            No customization options available for this dish.
          </div>
        )}

        {/* Special Instructions / Notes */}
        <div className="space-y-1.5">
          <label className="text-xs text-slate-300 font-bold block">
            Special Instructions / Kitchen Note
          </label>
          <input
            type="text"
            placeholder="e.g. Extra spicy, no onions, sauce on the side..."
            value={itemNotes}
            onChange={e => setItemNotes(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Quantity Controls & Add Button */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center bg-slate-950 rounded-2xl border border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-4 font-extrabold text-emerald-400 text-sm">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(q => Math.min(product.stock || 99, q + 1))}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 px-4 rounded-2xl transition cursor-pointer shadow-lg shadow-emerald-500/20 text-xs flex items-center justify-center gap-2"
          >
            <span>Add to Order (${(totalPrice || 0).toFixed(2)})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
