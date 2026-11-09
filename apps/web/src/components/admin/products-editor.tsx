'use client';

// A business's products (read-only on its page: name, price, availability; no stock counts).
// Each product saves on its own; its image is uploaded from its edit form.

import { formatPesos, parsePesos } from '@paw/domain';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type SubmitEvent } from 'react';
import {
  createProductAction,
  deleteMediaAction,
  deleteProductAction,
  updateProductAction,
} from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PRODUCT_AVAILABILITIES,
  type Media,
  type Product,
  type ProductAvailability,
} from '@/lib/admin-types';
import { errorAt, idleForm, type FormState } from '@/lib/form-errors';
import { priceLabels } from '@/lib/price-labels';
import { describedBy, FormField, FormStatus } from './form-field';
import { ImageUpload } from './image-upload';

interface Props {
  businessId: string;
  products: Product[];
  /** Each product's image; null when photo storage isn't set up. */
  images: { productId: string; image: Media }[] | null;
}

export function ProductsEditor({ businessId, products, images }: Props) {
  const imageOf = (productId: string) =>
    images?.find((entry) => entry.productId === productId)?.image ?? null;
  const t = useTranslations('AdminProducts');
  const tEnums = useTranslations('Enums');
  const prices = priceLabels(useTranslations('Prices'));
  // null: nothing open; 'new': the add form; a product id: that product's edit form.
  const [editing, setEditing] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const close = () => {
    setEditing(null);
  };

  return (
    <section aria-labelledby="products" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="products" className="text-xl font-semibold">
          {t('title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
      </div>

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-muted-foreground">{t('empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.category')}</TableHead>
              <TableHead>{t('columns.price')}</TableHead>
              <TableHead>{t('columns.availability')}</TableHead>
              <TableHead>
                <span className="sr-only">{t('columns.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) =>
              editing === product.id ? (
                <TableRow key={product.id}>
                  <TableCell colSpan={5} className="whitespace-normal">
                    <div className="flex flex-col gap-6">
                      <ProductForm businessId={businessId} product={product} onDone={close} />
                      <ProductImageField
                        productId={product.id}
                        image={imageOf(product.id)}
                        storageReady={images !== null}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Thumbnail image={imageOf(product.id)} />
                      {product.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.category ?? ''}</TableCell>
                  <TableCell>{prices.productPrice(product.price)}</TableCell>
                  <TableCell>{tEnums(`productAvailability.${product.availability}`)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(product.id);
                      }}
                    >
                      <Pencil aria-hidden />
                      {t('edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        setRemoveError(null);
                        startTransition(async () => {
                          const result = await deleteProductAction(product.id);
                          if (result.status === 'error') setRemoveError(t('removeFailed'));
                        });
                      }}
                    >
                      <Trash2 aria-hidden />
                      {t('remove')}
                    </Button>
                  </TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      )}
      {removeError !== null && (
        <p role="alert" className="text-sm text-destructive">
          {removeError}
        </p>
      )}

      {editing === 'new' ? (
        <div className="rounded-lg border p-3">
          <ProductForm businessId={businessId} onDone={close} />
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing('new');
            }}
          >
            <Plus aria-hidden />
            {t('add')}
          </Button>
        </div>
      )}
    </section>
  );
}

function Thumbnail({ image }: { image: Media | null }) {
  if (image === null) return <span aria-hidden className="size-10 shrink-0 rounded-md bg-muted" />;
  return (
    <Image
      src={image.url}
      alt={image.alt}
      width={image.width}
      height={image.height}
      unoptimized
      className="size-10 shrink-0 rounded-md bg-muted object-cover"
    />
  );
}

/** A product's one image: shown with its alt text, replaced by uploading, or deleted. */
function ProductImageField({
  productId,
  image,
  storageReady,
}: {
  productId: string;
  image: Media | null;
  storageReady: boolean;
}) {
  const t = useTranslations('AdminPhotos');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section aria-label={t('productImage')} className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-sm font-medium">{t('productImage')}</h3>
      {!storageReady ? (
        <p className="text-sm text-muted-foreground">{t('storageOff')}</p>
      ) : (
        <>
          {image !== null && (
            <div className="flex flex-wrap items-center gap-3">
              <Thumbnail image={image} />
              <span className="text-sm">{image.alt}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await deleteMediaAction(image.id);
                    if (result.status === 'error') setError(t('removeFailed'));
                  });
                }}
              >
                <Trash2 aria-hidden />
                {t('remove')}
              </Button>
            </div>
          )}
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <ImageUpload
            purpose="product_image"
            ownerId={productId}
            submitLabel={image === null ? t('addImage') : t('replaceImage')}
          />
        </>
      )}
    </section>
  );
}

function ProductForm({
  businessId,
  product,
  onDone,
}: {
  businessId: string;
  /** The product being edited; omit to add one. */
  product?: Product;
  onDone: () => void;
}) {
  const t = useTranslations('AdminProducts');
  const tForms = useTranslations('AdminForms');
  const tEnums = useTranslations('Enums');
  const [state, setState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [price, setPrice] = useState(
    product?.price === undefined || product.price === null ? '' : formatPesos(product.price),
  );
  const [availability, setAvailability] = useState<ProductAvailability>(
    product?.availability ?? 'available',
  );
  const idPrefix = product === undefined ? 'new-product' : `product-${product.id}`;

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const centavos = parsePesos(price);
    if (centavos === undefined) {
      setState({ status: 'error', formError: null, fieldErrors: { price: t('priceInvalid') } });
      return;
    }
    const body = {
      name,
      category: category.trim() === '' ? null : category.trim(),
      price: centavos,
      availability,
    };
    startTransition(async () => {
      const result =
        product === undefined
          ? await createProductAction(businessId, body)
          : await updateProductAction(product.id, body);
      setState(result);
      if (result.status === 'saved') onDone();
    });
  }

  const field = (key: string, hint?: string) => {
    const error = errorAt(state, key);
    return {
      id: `${idPrefix}-${key}`,
      'aria-invalid': error !== undefined,
      'aria-describedby': describedBy(`${idPrefix}-${key}`, hint, error),
    };
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <div className="min-w-64 flex-1">
          <FormField id={`${idPrefix}-name`} label={t('name')} error={errorAt(state, 'name')}>
            <Input
              {...field('name')}
              maxLength={200}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </FormField>
        </div>
        <FormField
          id={`${idPrefix}-category`}
          label={t('category')}
          labelSuffix={tForms('optional')}
          error={errorAt(state, 'category')}
        >
          <Input
            {...field('category')}
            className="w-48"
            maxLength={100}
            placeholder={t('categoryPlaceholder')}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
          />
        </FormField>
        <FormField
          id={`${idPrefix}-price`}
          label={t('price')}
          labelSuffix={tForms('optional')}
          hint={t('priceHint')}
          error={errorAt(state, 'price')}
        >
          <Input
            {...field('price', t('priceHint'))}
            className="w-36"
            inputMode="decimal"
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
            }}
          />
        </FormField>
        <FormField id={`${idPrefix}-availability`} label={t('availability')}>
          <NativeSelect
            {...field('availability')}
            value={availability}
            onChange={(event) => {
              const value = PRODUCT_AVAILABILITIES.find((a) => a === event.target.value);
              if (value !== undefined) setAvailability(value);
            }}
          >
            {PRODUCT_AVAILABILITIES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {tEnums(`productAvailability.${value}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tForms('saving') : t('save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('cancel')}
        </Button>
        <FormStatus
          formError={state.formError}
          hasFieldErrors={Object.keys(state.fieldErrors).length > 0}
          saved={false}
          fixErrorsLabel={tForms('fixErrors')}
          savedLabel={tForms('saved')}
        />
      </div>
    </form>
  );
}
