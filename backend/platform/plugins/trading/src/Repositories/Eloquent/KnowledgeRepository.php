<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use Platform\Plugins\Trading\Src\Models\Knowledge;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\KnowledgeInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class KnowledgeRepository implements KnowledgeInterface
{
    public function create(array $knowledge): Knowledge
    {

        return Knowledge::create($knowledge);
    }

    public function nonDuplicateInsert(array $knowledge): Knowledge
    {
        $existing = Knowledge::where('url_slug', $knowledge['url_slug'])->first();
        if ($existing) {
            return $existing;
        }
        return Knowledge::create($knowledge);
    }

    public function find(string $id): ?Knowledge
    {
        return Knowledge::find($id);
    }

    public function findAll($filter, $select, $perPage): LengthAwarePaginator
    {
        $query = Knowledge::query()->orderByDesc('published_at');

        if (!empty($filter)) {
            foreach ($filter as $field => $value) {
                $query->where($field, 'LIKE', "%$value%");
            }
        }

        if (!empty($select)) {
            $query->select($select);
        }

        return $query->paginate($perPage);
    }

    public function findByWords(array $words, int $perPage): LengthAwarePaginator
    {
        $query = Knowledge::query();

        $query->where(function ($q) use ($words) {
            foreach ($words as $word) {
                $q->orWhere('topic', 'LIKE', "%{$word}%");
            }
        })
            ->orWhere(function ($q) use ($words) {
                foreach ($words as $word) {
                    $q->orWhere('content', 'LIKE', "%{$word}%");
                }
            });

        $query->orderByRaw("
        CASE
            WHEN topic LIKE ? THEN 1
            ELSE 2
        END
    ", ['%' . $words[0] . '%'])
            ->orderByDesc('published_at');

        return $query->paginate($perPage);
    }

    public function search(array $keywords, int $perPage): LengthAwarePaginator
    {
        $query = Knowledge::query();

        $query->where(function ($q) use ($keywords) {
            foreach ($keywords as $word) {
                $q->orWhere('topic', 'LIKE', "%{$word}%")
                    ->orWhere('content', 'LIKE', "%{$word}%")
                    ->orWhere('author', 'LIKE', "%{$word}%");
            }
        });

        return $query
            ->orderByDesc('published_at')
            ->paginate($perPage);
    }


    public function findBySlug(string $slug): ?Knowledge
    {
        return Knowledge::where('url_slug', $slug)->first();
    }

    public function update(string $id, array $knowledge): ?Knowledge
    {
        $know = Knowledge::query()->find($id);
        if ($know) {
            if ($know instanceof Knowledge) {
                $know->update($knowledge);
            } else {
                throw new \Exception("Record not found or invalid model instance.");
            }
            return $know;
        }
        return null;
    }

    public function delete(string $id): bool
    {
        $know = Knowledge::query()->find($id);
        if ($know) {
            return (bool) $know->delete();
        }
        return false;
    }
}