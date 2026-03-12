<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use Platform\Plugins\Trading\Src\Models\News;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\NewsInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class NewsRepository implements NewsInterface
{
    public function create(array $news): News
    {

        return News::create($news);
    }

    public function find(string $id): ?News
    {
        return News::find($id);
    }

    public function findAll($filter, $select, $perPage): LengthAwarePaginator
    {
        $query = News::query()->orderByDesc('published_at');

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

    public function search(array $keywords, int $perPage): LengthAwarePaginator
    {
        $query = News::query();

        $query->where(function ($q) use ($keywords) {
            foreach ($keywords as $word) {
                $q->orWhere('title', 'LIKE', "%{$word}%")
                    ->orWhere('content', 'LIKE', "%{$word}%")
                    ->orWhere('author', 'LIKE', "%{$word}%");
            }
        });

        return $query
            ->orderByDesc('published_at')
            ->paginate($perPage);
    }

    public function delete(string $id): bool
    {
        $know = News::query()->find($id);
        if ($know) {
            return (bool) $know->delete();
        }
        return false;
    }
}