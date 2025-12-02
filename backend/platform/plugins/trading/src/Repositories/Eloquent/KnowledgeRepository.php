<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use Platform\Plugins\Trading\Src\Models\Knowledge;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\KnowledgeInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class KnowledgeRepository implements KnowledgeInterface {
    public function create(array $knowledge): Knowledge {

        return Knowledge::create($knowledge);
    }

    public function nonDuplicateInsert(array $knowledge): Knowledge {
        $existing = Knowledge::where('url_slug', $knowledge['url_slug'])->first();
        if ($existing) {
            return $existing;
        }
        return Knowledge::create($knowledge);
    }

    public function find(string $id): ?Knowledge {
        return Knowledge::find($id);
    }

    public function findAll($filter, $select, $perPage): LengthAwarePaginator {
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

    public function update(string $id, array $knowledge): ?Knowledge {
        $know = Knowledge::find($id);
        if ($know) {
            $know->update($knowledge);
            return $know;
        }
        return null;
    }

    public function delete(string $id): bool {
        $know = Knowledge::find($id);
        if ($know) {
            return (bool)$know->delete();
        }
        return false;
    }
}