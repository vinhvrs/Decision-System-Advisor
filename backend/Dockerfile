FROM php:8.4-fpm

# Cài đặt system dependencies cho ARM64
RUN apt-get update && apt-get install -y \
    git \
    curl \
    zip \
    unzip \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    libicu-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Cài đặt PHP extensions
RUN docker-php-ext-install pdo pdo_mysql mbstring zip intl gd

# Lấy Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www
COPY . .

# Chỉnh quyền cho Laravel
RUN chown -R www-data:www-data /var/www

EXPOSE 9000
CMD ["php-fpm"]
